import "dotenv/config";
import { randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";
import { hash } from "@node-rs/argon2";
import { db, disconnectDatabase } from "../server/shared/db";
import { hashAdminPassword } from "../server/admin/auth";
import { associatedData, PiiCipher } from "../server/crypto/envelope";
import { runtimeEnv } from "../server/shared/env";

import { createInterface } from "node:readline/promises";

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : undefined;
}

async function hiddenQuestion(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolvePromise, reject) => {
    let value = "";
    const onData = (chunk: string | Buffer) => {
      for (const character of String(chunk)) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Операция отменена"));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolvePromise(value);
          return;
        }
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    };
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  let email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() || getArg("--email")?.trim().toLowerCase();
  let password = process.env.ADMIN_BOOTSTRAP_PASSWORD || getArg("--password");

  if (!email || !password) {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      if (!email) email = (await rl.question("Email администратора: ")).trim().toLowerCase();
      rl.close();
      if (!password) {
        password = await hiddenQuestion("Пароль администратора (мин. 14 символов): ");
        const confirm = await hiddenQuestion("Повторите пароль: ");
        if (password !== confirm) throw new Error("Пароли не совпадают");
      }
    }
  }

  const mfaKey = runtimeEnv().MFA_ENCRYPTION_KEY;
  if (!email || !password || password.length < 14 || !mfaKey) {
    throw new Error("Необходимы email, пароль от 14 символов и MFA_ENCRYPTION_KEY (укажите в .env, аргументами --email/--password или введите интерактивно).");
  }

  const existingCount = await db.adminUser.count();
  if (existingCount > 0 && !process.argv.includes("--force")) {
    throw new Error("Администраторы уже существуют в базе. Для добавления или сброса используйте флаг --force.");
  }

  const userId = crypto.randomUUID();
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({ issuer: "МАНГАЛ", label: email, algorithm: "SHA1", digits: 6, period: 30, secret });
  const cipher = new PiiCipher(JSON.stringify({ activeKeyId: "mfa-v1", keys: { "mfa-v1": mfaKey } }));
  const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(8).toString("hex"));

  const passwordHash = await hashAdminPassword(password);
  const recoveryCodeHashes = await Promise.all(recoveryCodes.map(async (code) => ({ codeHash: await hash(code) })));

  const existingAdmin = await db.adminUser.findUnique({ where: { emailNormalized: email } });
  if (existingAdmin) {
    await db.$transaction([
      db.adminSession.updateMany({ where: { adminUserId: existingAdmin.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      db.adminTotpCredential.deleteMany({ where: { adminUserId: existingAdmin.id } }),
      db.adminRecoveryCode.deleteMany({ where: { adminUserId: existingAdmin.id } }),
      db.adminUser.update({
        where: { id: existingAdmin.id },
        data: {
          passwordHash,
          role: "ADMIN",
          isActive: true,
          mfaRequired: true,
          mfaEnrolledAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
          passwordChangedAt: new Date(),
        },
      }),
      db.adminTotpCredential.create({
        data: { adminUserId: existingAdmin.id, secretEncrypted: cipher.encrypt(secret.base32, associatedData(existingAdmin.id, "totp")) },
      }),
      db.adminRecoveryCode.createMany({
        data: recoveryCodeHashes.map(r => ({ adminUserId: existingAdmin.id, codeHash: r.codeHash })),
      }),
    ]);
  } else {
    await db.adminUser.create({
      data: {
        id: userId,
        emailNormalized: email,
        passwordHash,
        role: "ADMIN",
        mfaRequired: true,
        totpCredential: { create: { secretEncrypted: cipher.encrypt(secret.base32, associatedData(userId, "totp")) } },
        recoveryCodes: { create: recoveryCodeHashes },
        permissions: { create: { code: "REFUND_ORDER" } },
      },
    });
  }

  process.stdout.write(`\nАдминистратор ${email} успешно создан!\nMFA enrollment URI (показывается один раз):\n${totp.toString()}\nRecovery codes (показываются один раз):\n${recoveryCodes.join("\n")}\n`);
}

main().then(disconnectDatabase).catch(async (error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "Bootstrap failed"}\n`); await disconnectDatabase(); process.exitCode = 1; });

