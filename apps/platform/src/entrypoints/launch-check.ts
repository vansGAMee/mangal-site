import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db, disconnectDatabase } from "../server/shared/db";
import { PiiCipher } from "../server/crypto/envelope";

const REQUIRED_ENV = [
  "BUSINESS_LEGAL_NAME", "BUSINESS_INN", "BUSINESS_REGISTRATION_NUMBER", "BUSINESS_LEGAL_ADDRESS", "BUSINESS_EMAIL", "BUSINESS_PHONE",
  "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_PLATFORM_API_URL", "PLATFORM_API_URL", "ADMIN_BASE_URL", "ALLOWED_STOREFRONT_ORIGINS", "TRUSTED_PROXY_POLICY",
  "DATABASE_URL", "DIRECT_URL", "DATABASE_POOL_MAX", "DATABASE_CONNECTION_BUDGET", "WEB_MAX_INSTANCES", "WORKER_INSTANCE_COUNT", "RECONCILIATION_INSTANCE_COUNT", "RETENTION_INSTANCE_COUNT",
  "PII_KEY_RING_JSON", "PHONE_LOOKUP_HMAC_KEY", "ADMIN_SESSION_HMAC_KEY", "MFA_ENCRYPTION_KEY", "CSRF_HMAC_KEY", "INTERNAL_JOBS_TOKEN", "STOREFRONT_REVALIDATE_SECRET",
  "YOOKASSA_SHOP_ID", "YOOKASSA_SECRET_KEY", "TBANK_TERMINAL_KEY", "TBANK_PASSWORD",
  "FISCAL_TAX_SYSTEM", "FISCAL_DEFAULT_VAT_CODE", "FISCAL_PAYMENT_SUBJECT", "FISCAL_PAYMENT_MODE", "FISCAL_MEASURE_PIECE", "FISCAL_MEASURE_PORTION", "FISCAL_MEASURE_KILOGRAM",
  "FISCAL_DELIVERY_VAT_CODE", "FISCAL_DELIVERY_PAYMENT_SUBJECT", "FISCAL_DELIVERY_PAYMENT_MODE", "FISCAL_DELIVERY_MEASURE",
  "DELIVERY_ZONES_JSON", "OPERATING_HOURS_JSON", "CARD_PAYMENT_PROVIDER", "SBP_PAYMENT_PROVIDER", "NEXT_PUBLIC_YANDEX_METRIKA_ID",
  "LEGAL_PD_SHA256", "LEGAL_MARKETING_SHA256", "LEGAL_COOKIE_SHA256", "LEGAL_OFFER_SHA256", "LEGAL_TERMS_SHA256",
  "ORDER_PII_RETENTION_DAYS", "CONSENT_EVIDENCE_RETENTION_DAYS", "BACKUP_RPO_MINUTES", "BACKUP_RTO_MINUTES",
];

async function launchCheck(): Promise<void> {
  const failures: string[] = [];
  for (const name of REQUIRED_ENV) if (!process.env[name]?.trim()) failures.push(`${name}: missing`);
  if (process.env.LEGAL_DOCS_APPROVED !== "true") failures.push("LEGAL_DOCS_APPROVED: legal review not confirmed");
  for (const assertion of ["RKN_NOTIFICATION_CONFIRMED", "LEGAL_BASIS_REVIEWED", "LOCAL_ACTS_APPROVED", "RESPONSIBLE_PERSON_APPOINTED", "PROCESSOR_CONTRACTS_CONFIRMED", "TAX_PARAMETERS_CONFIRMED", "DELIVERY_SETTINGS_CONFIRMED", "MENU_VALUES_CONFIRMED", "UNPRICED_PRODUCTS_REVIEWED"]) {
    if (process.env[assertion] !== "true") failures.push(`${assertion}: manual organisational gate not confirmed`);
  }
  try { if (process.env.PII_KEY_RING_JSON) new PiiCipher(process.env.PII_KEY_RING_JSON); } catch { failures.push("PII_KEY_RING_JSON: invalid active key ring"); }
  const pool = Number(process.env.DATABASE_POOL_MAX), budget = Number(process.env.DATABASE_CONNECTION_BUDGET);
  const processes = Number(process.env.WEB_MAX_INSTANCES) + Number(process.env.WORKER_INSTANCE_COUNT) + Number(process.env.RECONCILIATION_INSTANCE_COUNT) + Number(process.env.RETENTION_INSTANCE_COUNT);
  if (!Number.isSafeInteger(pool) || !Number.isSafeInteger(budget) || !Number.isSafeInteger(processes) || pool * processes > budget) failures.push("DATABASE_CONNECTION_BUDGET: poolMax × processes exceeds budget");
  if (process.env.DATABASE_URL) {
    try {
      const [admins,zones,hours,products,unpriced,routes,documents] = await Promise.all([
        db.adminUser.count({where:{role:"ADMIN",isActive:true,mfaEnrolledAt:{not:null}}}), db.deliveryZone.count({where:{isActive:true}}), db.operatingHours.count(),
        db.product.count(), db.product.count({where:{requiresPriceConfirmation:true}}), db.paymentRouting.findMany({where:{isActive:true}}), db.legalDocumentVersion.findMany({where:{approved:true}}),
      ]);
      if (!admins) failures.push("ADMIN: no active MFA-enrolled administrator");
      if (!zones) failures.push("DeliveryZone: no active zones"); if (hours !== 7) failures.push("OperatingHours: all seven days must be configured");
      if (products !== 33) failures.push(`Product: expected 33 menu products, found ${products}`);
      if (unpriced !== 2) failures.push(`Product: expected exactly two operator-confirmation prices, found ${unpriced}`);
      if (!["CARD","SBP"].every((method)=>routes.some((route)=>route.method===method))) failures.push("PaymentRouting: CARD and SBP must be active");
      const orderableFiscalMissing = await db.product.count({where:{isOrderable:true,OR:[{fiscalVatCode:null},{fiscalPaymentSubject:null},{fiscalPaymentMode:null},{fiscalMeasure:null}]}});
      if (orderableFiscalMissing) failures.push(`Product fiscal profile: ${orderableFiscalMissing} orderable products incomplete`);
      const legalEnv: Record<string, string | undefined> = { "pd-v1": process.env.LEGAL_PD_SHA256, "marketing-v1": process.env.LEGAL_MARKETING_SHA256, "cookie-v1": process.env.LEGAL_COOKIE_SHA256, "offer-v1": process.env.LEGAL_OFFER_SHA256, "terms-v1": process.env.LEGAL_TERMS_SHA256 };
      for (const document of documents) { const diskPath = resolve(document.documentPath.replace(/^\//,"")); const hash = createHash("sha256").update(await readFile(diskPath)).digest("hex"); if (hash !== document.contentSha256 || legalEnv[document.version] !== hash) failures.push(`Legal document ${document.version}: content hash mismatch`); }
      if (documents.length < 5) failures.push("Legal documents: approved versions are incomplete");
    } catch { failures.push("Database launch checks could not be completed"); }
  }
  if (failures.length) { process.stderr.write(`PRODUCTION LAUNCH BLOCKED\n${failures.map((failure)=>`- ${failure}`).join("\n")}\n`); process.exitCode=1; }
  else process.stdout.write("Production launch check passed. Organisational gates must still be confirmed outside the application.\n");
}

launchCheck().finally(disconnectDatabase);
