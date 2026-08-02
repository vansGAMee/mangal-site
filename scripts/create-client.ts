import "dotenv/config";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { hash } from "@node-rs/argon2";
import * as OTPAuth from "otpauth";
import { z } from "zod";
import { RestaurantProfileInputSchema } from "@mangal/contracts";
import { applyMenuImport, parseMenuImport } from "../apps/platform/src/server/catalog/menu-import";
import { hashAdminPassword } from "../apps/platform/src/server/admin/auth";
import { associatedData, PiiCipher } from "../apps/platform/src/server/crypto/envelope";
import { db, disconnectDatabase } from "../apps/platform/src/server/shared/db";
import { runtimeEnv } from "../apps/platform/src/server/shared/env";

const ClientConfigSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1_000),
  phone: z.string().trim().min(7).max(40),
  phoneDisplay: z.string().trim().min(7).max(40).optional(),
  address: z.string().trim().min(1).max(300),
  adminEmail: z.string().email().max(254),
  adminPasswordEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/).optional(),
  theme: z.enum(["mangal-dark", "cafe-light", "sushi-minimal"]),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  minimumOrderKopecks: z.number().int().nonnegative().nullable(),
  deliveryFeeKopecks: z.number().int().nonnegative().nullable(),
  timezone: z.string().trim().min(1).max(80),
  menuPath: z.string().trim().min(1),
}).strict();

type ClientConfig = z.infer<typeof ClientConfigSchema>;

async function main(): Promise<void> {
  const configPath = argument("--config");
  const force = process.argv.includes("--force");
  const { config, password, baseDirectory } = configPath
    ? await configMode(configPath)
    : await interactiveMode();
  const normalizedPhone = normalizeRussianPhone(config.phone);
  const profile = RestaurantProfileInputSchema.parse({
    slug: config.slug,
    name: config.name,
    description: config.description,
    logoPath: null,
    faviconPath: null,
    heroImagePath: null,
    theme: themeEnum(config.theme),
    primaryColor: config.primaryColor,
    secondaryColor: config.secondaryColor,
    ...themeSurfaces(config.theme),
    phoneDisplay: config.phoneDisplay ?? displayPhone(normalizedPhone),
    phoneHref: normalizedPhone,
    email: null,
    address: config.address,
    latitude: null,
    longitude: null,
    vkUrl: null,
    telegramUrl: null,
    whatsappUrl: null,
    currency: "RUB",
    timezone: config.timezone,
    seoTitle: `${config.name} — онлайн-меню`,
    seoDescription: config.description,
    legalName: null,
    legalInn: null,
    legalRegistrationNo: null,
    legalAddress: null,
    privacyPolicyPath: "/legal/privacy",
    deliveryEnabled: false,
    pickupEnabled: true,
    pickupLabel: `Самовывоз: ${config.address}`,
  });
  const menuFile = resolve(baseDirectory, config.menuPath);
  const menuPlan = parseMenuImport(basename(menuFile), await readFile(menuFile));
  const env = runtimeEnv();
  if (!env.MFA_ENCRYPTION_KEY) throw new Error("MFA_ENCRYPTION_KEY is required to create an ADMIN");
  if (password.length < 14) throw new Error("Пароль администратора должен содержать не менее 14 символов");

  const [existingProfile, existingAdminCount] = await Promise.all([
    db.restaurantProfile.findUnique({ where: { id: "singleton" } }),
    db.adminUser.count(),
  ]);
  if ((existingProfile || existingAdminCount > 0) && !force) {
    throw new Error("Конфигурация или ADMIN уже существуют. Проверьте базу; для осознанной перезаписи используйте --force.");
  }

  const userId = randomUUID();
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: config.name,
    label: config.adminEmail.toLowerCase(),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
  const cipher = new PiiCipher(JSON.stringify({ activeKeyId: "mfa-v1", keys: { "mfa-v1": env.MFA_ENCRYPTION_KEY } }));
  const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(8).toString("hex"));
  const [passwordHash, recoveryCodeHashes, legalDrafts] = await Promise.all([
    hashAdminPassword(password),
    Promise.all(recoveryCodes.map(async (code) => hash(code))),
    loadLegalDrafts(),
  ]);

  const result = await db.$transaction(async (tx) => {
    await tx.restaurantProfile.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...profile },
      update: force ? { ...profile, version: { increment: 1 } } : {},
    });
    await tx.storeSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        phoneDisplay: profile.phoneDisplay!,
        phoneHref: profile.phoneHref!,
        leadTimeMinutes: 15,
        minimumOrderKopecks: config.minimumOrderKopecks,
        deliveryPricingConfig: config.deliveryFeeKopecks === null
          ? null
          : { pendingDefaultFeeKopecks: config.deliveryFeeKopecks },
        legalBasis: "CONTRACT",
        taxSystemCode: null,
      },
      update: force
        ? {
            phoneDisplay: profile.phoneDisplay!,
            phoneHref: profile.phoneHref!,
            minimumOrderKopecks: config.minimumOrderKopecks,
            deliveryPricingConfig: config.deliveryFeeKopecks === null
              ? null
              : { pendingDefaultFeeKopecks: config.deliveryFeeKopecks },
            version: { increment: 1 },
          }
        : {},
    });
    for (const draft of legalDrafts) {
      const existing = await tx.legalDocumentVersion.findUnique({
        where: { type_version: { type: draft.type, version: draft.version } },
      });
      if (existing && existing.contentSha256 !== draft.contentSha256) {
        throw new Error(`Legal document ${draft.type}/${draft.version} changed; create a new version`);
      }
      if (!existing) await tx.legalDocumentVersion.create({ data: draft });
    }

    const existingAdmin = await tx.adminUser.findUnique({ where: { emailNormalized: config.adminEmail.toLowerCase() } });
    if (existingAdmin && force) {
      await tx.adminSession.updateMany({ where: { adminUserId: existingAdmin.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.adminTotpCredential.deleteMany({ where: { adminUserId: existingAdmin.id } });
      await tx.adminRecoveryCode.deleteMany({ where: { adminUserId: existingAdmin.id } });
    }
    const admin = existingAdmin
      ? await tx.adminUser.update({
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
        })
      : await tx.adminUser.create({
          data: {
            id: userId,
            emailNormalized: config.adminEmail.toLowerCase(),
            passwordHash,
            role: "ADMIN",
            mfaRequired: true,
          },
        });
    await tx.adminTotpCredential.create({
      data: {
        adminUserId: admin.id,
        secretEncrypted: cipher.encrypt(secret.base32, associatedData(admin.id, "totp")),
      },
    });
    await tx.adminRecoveryCode.createMany({
      data: recoveryCodeHashes.map((codeHash) => ({ adminUserId: admin.id, codeHash })),
    });
    await tx.adminPermission.upsert({
      where: { adminUserId_code: { adminUserId: admin.id, code: "REFUND_ORDER" } },
      create: { adminUserId: admin.id, code: "REFUND_ORDER" },
      update: {},
    });
    const menu = await applyMenuImport(tx, menuPlan, { dryRun: false, updateExisting: false });
    await tx.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        action: "CLIENT_PROVISIONED",
        targetType: "RestaurantProfile",
        targetId: "singleton",
        metadata: { slug: config.slug, menuImportSha256: menu.sourceSha256, force },
        requestId: `cli-${randomUUID()}`,
      },
    });
    return menu;
  }, { timeout: 120_000 });

  process.stdout.write([
    "Клиент создан. Пароль не выводится и не сохраняется в конфигурации.",
    `Импорт меню: создано ${result.createdCount}, пропущено ${result.skippedCount}.`,
    "Добавьте TOTP в приложение-аутентификатор (URI показывается один раз):",
    totp.toString(),
    "Recovery codes (показываются один раз, сохраните офлайн):",
    ...recoveryCodes,
    "Дальше: настройте часы, зону доставки, фискальные параметры и эквайринг в /admin/settings.",
    "Запуск: npm run dev:platform и npm run dev:storefront",
  ].join("\n") + "\n");
}

async function configMode(configPathValue: string): Promise<{ config: ClientConfig; password: string; baseDirectory: string }> {
  const configPath = resolve(configPathValue);
  const config = ClientConfigSchema.parse(JSON.parse(await readFile(configPath, "utf8")));
  if (!config.adminPasswordEnv) throw new Error("В config укажите adminPasswordEnv, а пароль передайте через эту переменную окружения");
  const password = process.env[config.adminPasswordEnv];
  if (!password) throw new Error(`Переменная ${config.adminPasswordEnv} не задана`);
  return { config, password, baseDirectory: dirname(configPath) };
}

async function interactiveMode(): Promise<{ config: ClientConfig; password: string; baseDirectory: string }> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Интерактивный режим требует TTY; используйте --config");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const raw = {
    slug: await rl.question("Slug: "),
    name: await rl.question("Название: "),
    description: await rl.question("Описание: "),
    phone: await rl.question("Телефон (+7…): "),
    address: await rl.question("Адрес: "),
    adminEmail: await rl.question("Email администратора: "),
    theme: await rl.question("Тема (mangal-dark / cafe-light / sushi-minimal): "),
    primaryColor: await rl.question("Основной цвет (#RRGGBB): "),
    secondaryColor: await rl.question("Дополнительный цвет (#RRGGBB): "),
    minimumOrderKopecks: nullableInteger(await rl.question("Минимальная сумма, коп. (пусто = не задана): ")),
    deliveryFeeKopecks: nullableInteger(await rl.question("Стоимость доставки, коп. (пусто = не задана): ")),
    timezone: await rl.question("Часовой пояс (например Europe/Moscow): "),
    menuPath: await rl.question("Путь к CSV или JSON меню: "),
  };
  rl.close();
  const password = await hiddenQuestion("Пароль администратора (не показывается): ");
  const confirmation = await hiddenQuestion("Повторите пароль: ");
  if (password !== confirmation) throw new Error("Пароли не совпадают");
  return { config: ClientConfigSchema.parse(raw), password, baseDirectory: process.cwd() };
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

async function loadLegalDrafts() {
  const inputs = [
    { type: "PERSONAL_DATA" as const, version: "pd-v1", file: "docs/legal/pd-v1.md", documentPath: "/legal/privacy" },
    { type: "MARKETING" as const, version: "marketing-v1", file: "docs/legal/marketing-v1.md", documentPath: "/legal/marketing" },
    { type: "COOKIE" as const, version: "cookie-v1", file: "docs/legal/cookie-v1.md", documentPath: "/legal/cookies" },
    { type: "OFFER" as const, version: "offer-v1", file: "docs/legal/offer-v1.md", documentPath: "/legal/offer" },
    { type: "TERMS" as const, version: "terms-v1", file: "docs/legal/terms-v1.md", documentPath: "/legal/terms" },
  ];
  return Promise.all(inputs.map(async (item) => ({
    type: item.type,
    version: item.version,
    documentPath: item.documentPath,
    contentSha256: createHash("sha256").update(await readFile(resolve(item.file))).digest("hex"),
    approved: false,
  })));
}

function themeEnum(theme: ClientConfig["theme"]): "MANGAL_DARK" | "CAFE_LIGHT" | "SUSHI_MINIMAL" {
  return theme.replaceAll("-", "_").toUpperCase() as "MANGAL_DARK" | "CAFE_LIGHT" | "SUSHI_MINIMAL";
}

function themeSurfaces(theme: ClientConfig["theme"]) {
  if (theme === "cafe-light") return { backgroundColor: "#F7F2E8", foregroundColor: "#1B1A18" };
  if (theme === "sushi-minimal") return { backgroundColor: "#F3F3EE", foregroundColor: "#171A17" };
  return { backgroundColor: "#0D0D0E", foregroundColor: "#F4F1EA" };
}

function normalizeRussianPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) return `+7${digits.slice(1)}`;
  if (value.startsWith("+") && digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  throw new Error("Телефон должен быть в международном формате, например +79991234567");
}

function displayPhone(phone: string): string {
  if (/^\+7\d{10}$/.test(phone)) return `+7 ${phone.slice(2, 5)} ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`;
  return phone;
}

function nullableInteger(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error("Ожидалось неотрицательное целое число");
  return number;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

main()
  .then(disconnectDatabase)
  .catch(async (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Client creation failed"}\n`);
    await disconnectDatabase();
    process.exitCode = 1;
  });
