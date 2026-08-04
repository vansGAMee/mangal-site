import { z } from "zod";

const blankToUndefined = (value: unknown) => typeof value === "string" && value.trim() === "" ? undefined : value;
const optionalTrimmed = z.preprocess(blankToUndefined, z.string().trim().min(1).optional());
const positiveInt = z.preprocess(blankToUndefined, z.coerce.number().int().positive());

const RuntimeEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().default("postgresql://dummy:dummy@127.0.0.1:5432/mangal?schema=public"),
  DATABASE_POOL_MAX: positiveInt.default(5),
  DATABASE_CONNECT_TIMEOUT_MS: positiveInt.default(5_000),
  DATABASE_STATEMENT_TIMEOUT_MS: positiveInt.default(10_000),
  PII_KEY_RING_JSON: optionalTrimmed,
  PHONE_LOOKUP_HMAC_KEY: optionalTrimmed,
  ADMIN_SESSION_HMAC_KEY: optionalTrimmed,
  MFA_ENCRYPTION_KEY: optionalTrimmed,
  CSRF_HMAC_KEY: optionalTrimmed,
  INTERNAL_JOBS_TOKEN: optionalTrimmed,
  STORAGE_DRIVER: z.enum(["local", "vercel-blob"]).default("local"),
  LOCAL_MEDIA_ROOT: optionalTrimmed,
  MEDIA_PUBLIC_BASE_URL: z.string().url().optional(),
  BLOB_READ_WRITE_TOKEN: optionalTrimmed,
  IMAGE_MAX_BYTES: positiveInt.default(5 * 1024 * 1024),
  DEMO_MODE: z.stringbool().default(false),
  DEMO_RESET_SECRET: optionalTrimmed,
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

export function clearRuntimeEnvCacheForTests(): void {
  if (process.env.NODE_ENV !== "test") throw new Error("Runtime env cache can only be cleared in tests");
  cached = undefined;
}
