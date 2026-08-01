import { z } from "zod";

const optionalTrimmed = z.string().trim().min(1).optional();
const positiveInt = z.coerce.number().int().positive();

const RuntimeEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().default("postgresql://postgres:postgres@localhost:5432/mangal_dev"),
  DATABASE_POOL_MAX: positiveInt.default(5),
  DATABASE_CONNECT_TIMEOUT_MS: positiveInt.default(5_000),
  DATABASE_STATEMENT_TIMEOUT_MS: positiveInt.default(10_000),
  PII_KEY_RING_JSON: optionalTrimmed,
  PHONE_LOOKUP_HMAC_KEY: optionalTrimmed,
  ADMIN_SESSION_HMAC_KEY: optionalTrimmed,
  MFA_ENCRYPTION_KEY: optionalTrimmed,
  CSRF_HMAC_KEY: optionalTrimmed,
  INTERNAL_JOBS_TOKEN: optionalTrimmed,
  ALLOWED_STOREFRONT_ORIGINS: optionalTrimmed,
  PERSONAL_DATA_LEGAL_BASIS: z.enum(["CONTRACT", "CONSENT"]).default("CONTRACT"),
  PAYMENT_HTTP_TIMEOUT_MS: positiveInt.default(8_000),
  YOOKASSA_SHOP_ID: optionalTrimmed,
  YOOKASSA_SECRET_KEY: optionalTrimmed,
  YOOKASSA_API_BASE_URL: z.string().url().default("https://api.yookassa.ru/v3"),
  TBANK_TERMINAL_KEY: optionalTrimmed,
  TBANK_PASSWORD: optionalTrimmed,
  TBANK_API_BASE_URL: z.string().url().default("https://securepay.tinkoff.ru/v2"),
});

export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

let cached: RuntimeEnv | undefined;

export function runtimeEnv(): RuntimeEnv {
  cached ??= RuntimeEnvSchema.parse(process.env);
  return cached;
}

export function allowedStorefrontOrigins(): Set<string> {
  return new Set(
    (runtimeEnv().ALLOWED_STOREFRONT_ORIGINS ?? "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}
