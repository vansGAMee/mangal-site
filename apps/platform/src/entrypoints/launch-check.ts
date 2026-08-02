import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PiiCipher } from "../server/crypto/envelope";
import { db, disconnectDatabase } from "../server/shared/db";

const REQUIRED_ENV = [
  "BUSINESS_LEGAL_NAME", "BUSINESS_INN", "BUSINESS_REGISTRATION_NUMBER", "BUSINESS_LEGAL_ADDRESS", "BUSINESS_EMAIL", "BUSINESS_PHONE",
  "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_PLATFORM_API_URL", "PLATFORM_API_URL", "ADMIN_BASE_URL", "ALLOWED_STOREFRONT_ORIGINS", "TRUSTED_PROXY_POLICY",
  "DATABASE_URL", "DIRECT_URL", "DATABASE_POOL_MAX", "DATABASE_CONNECTION_BUDGET", "WEB_MAX_INSTANCES", "WORKER_INSTANCE_COUNT", "RECONCILIATION_INSTANCE_COUNT", "RETENTION_INSTANCE_COUNT",
  "PII_KEY_RING_JSON", "PHONE_LOOKUP_HMAC_KEY", "ADMIN_SESSION_HMAC_KEY", "MFA_ENCRYPTION_KEY", "CSRF_HMAC_KEY", "INTERNAL_JOBS_TOKEN", "STOREFRONT_REVALIDATE_SECRET",
  "YOOKASSA_SHOP_ID", "YOOKASSA_SECRET_KEY", "TBANK_TERMINAL_KEY", "TBANK_PASSWORD",
  "FISCAL_TAX_SYSTEM", "FISCAL_DEFAULT_VAT_CODE", "FISCAL_PAYMENT_SUBJECT", "FISCAL_PAYMENT_MODE", "FISCAL_MEASURE_PIECE", "FISCAL_MEASURE_PORTION", "FISCAL_MEASURE_KILOGRAM",
  "FISCAL_DELIVERY_VAT_CODE", "FISCAL_DELIVERY_PAYMENT_SUBJECT", "FISCAL_DELIVERY_PAYMENT_MODE", "FISCAL_DELIVERY_MEASURE",
  "CARD_PAYMENT_PROVIDER", "SBP_PAYMENT_PROVIDER", "NEXT_PUBLIC_YANDEX_METRIKA_ID",
  "LEGAL_PD_SHA256", "LEGAL_MARKETING_SHA256", "LEGAL_COOKIE_SHA256", "LEGAL_OFFER_SHA256", "LEGAL_TERMS_SHA256",
  "ORDER_PII_RETENTION_DAYS", "CONSENT_EVIDENCE_RETENTION_DAYS", "BACKUP_RPO_MINUTES", "BACKUP_RTO_MINUTES",
] as const;

const ORGANISATIONAL_GATES = [
  "RKN_NOTIFICATION_CONFIRMED", "LEGAL_BASIS_REVIEWED", "LOCAL_ACTS_APPROVED", "RESPONSIBLE_PERSON_APPOINTED",
  "PROCESSOR_CONTRACTS_CONFIRMED", "TAX_PARAMETERS_CONFIRMED", "DELIVERY_SETTINGS_CONFIRMED", "MENU_VALUES_CONFIRMED", "UNPRICED_PRODUCTS_REVIEWED",
] as const;

const LEGAL_FILES: Record<string, string> = {
  "pd-v1": "docs/legal/pd-v1.md",
  "marketing-v1": "docs/legal/marketing-v1.md",
  "cookie-v1": "docs/legal/cookie-v1.md",
  "offer-v1": "docs/legal/offer-v1.md",
  "terms-v1": "docs/legal/terms-v1.md",
};

const LEGAL_HASH_ENV: Record<string, string | undefined> = {
  "pd-v1": process.env.LEGAL_PD_SHA256,
  "marketing-v1": process.env.LEGAL_MARKETING_SHA256,
  "cookie-v1": process.env.LEGAL_COOKIE_SHA256,
  "offer-v1": process.env.LEGAL_OFFER_SHA256,
  "terms-v1": process.env.LEGAL_TERMS_SHA256,
};

async function launchCheck(): Promise<void> {
  const failures: string[] = [];
  for (const name of REQUIRED_ENV) if (!process.env[name]?.trim()) failures.push(`${name}: missing`);
  if (process.env.DEMO_MODE === "true") failures.push("DEMO_MODE: production cannot run in demo mode");
  if (process.env.LEGAL_DOCS_APPROVED !== "true") failures.push("LEGAL_DOCS_APPROVED: legal review not confirmed");
  for (const gate of ORGANISATIONAL_GATES) {
    if (process.env[gate] !== "true") failures.push(`${gate}: manual organisational gate not confirmed`);
  }

  try {
    if (process.env.PII_KEY_RING_JSON) new PiiCipher(process.env.PII_KEY_RING_JSON);
  } catch {
    failures.push("PII_KEY_RING_JSON: invalid active key ring");
  }
  validateConnectionBudget(failures);
  validateStorageConfiguration(failures);
  validateStaticConfiguration(failures);

  if (process.env.DATABASE_URL) {
    try {
      await validateDatabaseState(failures);
    } catch {
      failures.push("Database launch checks could not be completed");
    }
  }

  if (failures.length) {
    process.stderr.write(`PRODUCTION LAUNCH BLOCKED\n${failures.map((failure) => `- ${failure}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Production launch check passed. Organisational gates must still be confirmed outside the application.\n");
}

function validateConnectionBudget(failures: string[]): void {
  const pool = Number(process.env.DATABASE_POOL_MAX);
  const budget = Number(process.env.DATABASE_CONNECTION_BUDGET);
  const processes = Number(process.env.WEB_MAX_INSTANCES)
    + Number(process.env.WORKER_INSTANCE_COUNT)
    + Number(process.env.RECONCILIATION_INSTANCE_COUNT)
    + Number(process.env.RETENTION_INSTANCE_COUNT);
  if (!Number.isSafeInteger(pool) || pool <= 0 || !Number.isSafeInteger(budget) || budget <= 0 || !Number.isSafeInteger(processes) || processes <= 0 || pool * processes > budget) {
    failures.push("DATABASE_CONNECTION_BUDGET: poolMax × total processes must be positive and stay within the operator-defined budget");
  }
}

function validateStorageConfiguration(failures: string[]): void {
  if (process.env.STORAGE_DRIVER === "vercel-blob" && !process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    failures.push("BLOB_READ_WRITE_TOKEN: required for vercel-blob storage");
  }
  if ((process.env.STORAGE_DRIVER ?? "local") === "local" && (!process.env.LOCAL_MEDIA_ROOT?.trim() || !process.env.MEDIA_PUBLIC_BASE_URL?.trim())) {
    failures.push("Local media storage: LOCAL_MEDIA_ROOT and MEDIA_PUBLIC_BASE_URL are required");
  }
}

function validateStaticConfiguration(failures: string[]): void {
  for (const name of ["PHONE_LOOKUP_HMAC_KEY", "ADMIN_SESSION_HMAC_KEY", "MFA_ENCRYPTION_KEY", "CSRF_HMAC_KEY"] as const) {
    const value = process.env[name];
    if (value && Buffer.from(value, "base64").byteLength !== 32) failures.push(`${name}: must be a base64-encoded 32-byte key`);
  }
  for (const name of ["INTERNAL_JOBS_TOKEN", "STOREFRONT_REVALIDATE_SECRET"] as const) {
    const value = process.env[name];
    if (value && value.length < 32) failures.push(`${name}: must contain at least 32 characters of random data`);
  }
  if (!["YANDEX", "VERIFIED_X_FORWARDED_FOR"].includes(process.env.TRUSTED_PROXY_POLICY ?? "")) {
    failures.push("TRUSTED_PROXY_POLICY: select an explicitly configured trusted proxy policy");
  }
  for (const name of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_PLATFORM_API_URL", "PLATFORM_API_URL", "ADMIN_BASE_URL"] as const) {
    const value = process.env[name];
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    } catch {
      failures.push(`${name}: production value must be an HTTPS origin without credentials or path`);
    }
  }
  const origins = (process.env.ALLOWED_STOREFRONT_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length || origins.some((origin) => {
    try {
      const url = new URL(origin);
      return url.origin !== origin || url.protocol !== "https:" || origin.includes("*");
    } catch {
      return true;
    }
  })) failures.push("ALLOWED_STOREFRONT_ORIGINS: use an exact comma-separated HTTPS origin allowlist without wildcards");
  if (process.env.BUSINESS_INN && !/^(?:\d{10}|\d{12})$/.test(process.env.BUSINESS_INN)) failures.push("BUSINESS_INN: invalid format");
  if (process.env.BUSINESS_REGISTRATION_NUMBER && !/^(?:\d{13}|\d{15})$/.test(process.env.BUSINESS_REGISTRATION_NUMBER)) failures.push("BUSINESS_REGISTRATION_NUMBER: invalid format");
  if (process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID && !/^\d+$/.test(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID)) failures.push("NEXT_PUBLIC_YANDEX_METRIKA_ID: expected a numeric counter ID");
}

async function validateDatabaseState(failures: string[]): Promise<void> {
  const [admins, zones, hours, products, routes, documents, profile, sentinel] = await Promise.all([
    db.adminUser.count({ where: { role: "ADMIN", isActive: true, mfaEnrolledAt: { not: null } } }),
    db.deliveryZone.count({ where: { isActive: true } }),
    db.operatingHours.count(),
    db.product.count(),
    db.paymentRouting.findMany({ where: { isActive: true } }),
    db.legalDocumentVersion.findMany({ where: { approved: true } }),
    db.restaurantProfile.findUnique({ where: { id: "singleton" } }),
    db.migrationSentinel.findUnique({ where: { id: 1 } }),
  ]);

  if (sentinel?.version !== "202608020001_productization") failures.push("MigrationSentinel: productization migration is not current");
  if (!admins) failures.push("ADMIN: no active MFA-enrolled administrator");
  if (!products) failures.push("Product: catalog is empty");
  if (!profile) {
    failures.push("RestaurantProfile: missing singleton profile");
  } else {
    if (!profile.deliveryEnabled && !profile.pickupEnabled) failures.push("RestaurantProfile: at least one fulfillment method must be enabled");
    if (profile.deliveryEnabled && !zones) failures.push("DeliveryZone: delivery is enabled but no active zones exist");
    if (profile.pickupEnabled && (!profile.address?.trim() || !profile.pickupLabel?.trim())) failures.push("RestaurantProfile: pickup requires a confirmed address and pickup label");
    if (!profile.legalName || !profile.legalInn || !profile.legalRegistrationNo || !profile.legalAddress || !profile.email) failures.push("RestaurantProfile: operator requisites and email are incomplete");
  }
  if (hours !== 7) failures.push("OperatingHours: all seven days must be configured");
  if (!["CARD", "SBP"].every((method) => routes.some((route) => route.method === method))) failures.push("PaymentRouting: CARD and SBP must be active");
  for (const route of routes) {
    const configured = process.env[route.method === "CARD" ? "CARD_PAYMENT_PROVIDER" : "SBP_PAYMENT_PROVIDER"];
    if (configured !== route.provider) failures.push(`PaymentRouting ${route.method}: database route does not match launch configuration`);
  }

  const orderableFiscalMissing = await db.product.count({
    where: { isOrderable: true, OR: [{ fiscalVatCode: null }, { fiscalPaymentSubject: null }, { fiscalPaymentMode: null }, { fiscalMeasure: null }] },
  });
  if (orderableFiscalMissing) failures.push(`Product fiscal profile: ${orderableFiscalMissing} orderable products incomplete`);
  await validateLegalDocuments(documents, failures);
}

async function validateLegalDocuments(
  documents: Array<{ version: string; contentSha256: string }>,
  failures: string[],
): Promise<void> {
  for (const [version, filePath] of Object.entries(LEGAL_FILES)) {
    const document = documents.find((candidate) => candidate.version === version);
    if (!document) {
      failures.push(`Legal document ${version}: approved version is missing`);
      continue;
    }
    const hash = createHash("sha256").update(await readFile(resolve(filePath))).digest("hex");
    if (hash !== document.contentSha256 || LEGAL_HASH_ENV[version] !== hash) failures.push(`Legal document ${version}: content hash mismatch`);
  }
}

void launchCheck().finally(disconnectDatabase);
