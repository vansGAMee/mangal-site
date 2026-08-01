import { PiiCipher } from "../crypto/envelope";
import { db } from "../shared/db";

export async function readiness(): Promise<{ ready: boolean; checks: Record<string, boolean> }> {
  const checks: Record<string, boolean> = { process: true, database: false, migrations: false, criticalTables: false, encryption: false, routing: false };
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = true;
    const sentinel = await db.migrationSentinel.findUnique({ where: { id: 1 } });
    checks.migrations = Boolean(sentinel);
    await Promise.all([db.order.count({ take: 1 }), db.paymentAttempt.count({ take: 1 }), db.outboxEvent.count({ take: 1 }), db.legalConsent.count({ take: 1 })]);
    checks.criticalTables = true;
    if (process.env.PII_KEY_RING_JSON) { new PiiCipher(process.env.PII_KEY_RING_JSON); checks.encryption = true; }
    const routes = await db.paymentRouting.findMany({ where: { isActive: true } });
    checks.routing = ["CARD", "SBP"].every((method) => routes.some((route) => route.method === method && providerConfigured(route.provider)));
  } catch { /* readiness reports individual false values and never leaks diagnostics */ }
  return { ready: Object.values(checks).every(Boolean), checks };
}

function providerConfigured(provider: "YOOKASSA" | "TBANK"): boolean {
  return provider === "YOOKASSA" ? Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY) : Boolean(process.env.TBANK_TERMINAL_KEY && process.env.TBANK_PASSWORD);
}
