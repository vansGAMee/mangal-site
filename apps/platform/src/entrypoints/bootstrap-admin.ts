import "dotenv/config";
import { randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";
import { hash } from "@node-rs/argon2";
import { db, disconnectDatabase } from "../server/shared/db";
import { hashAdminPassword } from "../server/admin/auth";
import { associatedData, PiiCipher } from "../server/crypto/envelope";
import { runtimeEnv } from "../server/shared/env";

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const mfaKey = runtimeEnv().MFA_ENCRYPTION_KEY;
  if (!email || !password || password.length < 14 || !mfaKey) throw new Error("ADMIN_BOOTSTRAP_EMAIL, a 14+ character password and MFA_ENCRYPTION_KEY are required");
  if (await db.adminUser.count()) throw new Error("Bootstrap is allowed only when no admin users exist");
  const userId = crypto.randomUUID();
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({ issuer: "МАНГАЛ", label: email, algorithm: "SHA1", digits: 6, period: 30, secret });
  const cipher = new PiiCipher(JSON.stringify({ activeKeyId: "mfa-v1", keys: { "mfa-v1": mfaKey } }));
  const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(8).toString("hex"));
  await db.adminUser.create({
    data: {
      id: userId,
      emailNormalized: email,
      passwordHash: await hashAdminPassword(password),
      role: "ADMIN",
      mfaRequired: true,
      totpCredential: { create: { secretEncrypted: cipher.encrypt(secret.base32, associatedData(userId, "totp")) } },
      recoveryCodes: { create: await Promise.all(recoveryCodes.map(async (code) => ({ codeHash: await hash(code) }))) },
    },
  });
  process.stdout.write(`MFA enrollment URI (shown once):\n${totp.toString()}\nRecovery codes (shown once):\n${recoveryCodes.join("\n")}\n`);
}

main().then(disconnectDatabase).catch(async (error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "Bootstrap failed"}\n`); await disconnectDatabase(); process.exitCode = 1; });
