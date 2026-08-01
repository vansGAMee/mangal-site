import { db } from "../shared/db";
import { associatedData, PiiCipher } from "../crypto/envelope";
import { runtimeEnv } from "../shared/env";

export async function runRetentionBatch(limit = 100): Promise<{ orders: number; consents: number }> {
  const orderDays = Number(process.env.ORDER_PII_RETENTION_DAYS);
  const consentDays = Number(process.env.CONSENT_EVIDENCE_RETENTION_DAYS);
  if (!Number.isSafeInteger(orderDays) || orderDays <= 0 || !Number.isSafeInteger(consentDays) || consentDays <= 0) throw new Error("Retention periods are not configured");
  const env = runtimeEnv(); if (!env.PII_KEY_RING_JSON) throw new Error("PII encryption is unavailable");
  const cipher = new PiiCipher(env.PII_KEY_RING_JSON);
  const orders = await db.order.findMany({ where: { fulfillmentStatus: { in: ["COMPLETED", "CANCELED"] }, updatedAt: { lt: new Date(Date.now() - orderDays * 86_400_000) } }, take: limit, select: { id: true } });
  for (const order of orders) {
    const erased = (field: string) => cipher.encrypt("[retention-erased]", associatedData(order.id, field));
    await db.order.update({ where: { id: order.id }, data: { phoneEncrypted: erased("phone"), emailEncrypted: erased("email"), cityEncrypted: erased("city"), streetEncrypted: erased("street"), houseEncrypted: erased("house"), apartmentEncrypted: erased("apartment"), entranceEncrypted: erased("entrance"), floorEncrypted: erased("floor"), intercomEncrypted: erased("intercom"), commentEncrypted: erased("comment"), phoneLookupHash: `erased:${order.id}` } });
  }
  const consents = await db.legalConsent.findMany({ where: { acceptedAt: { lt: new Date(Date.now() - consentDays * 86_400_000) } }, take: limit, select: { id: true } });
  for (const consent of consents) await db.legalConsent.update({ where: { id: consent.id }, data: { ipEncrypted: cipher.encrypt("[retention-erased]", associatedData(consent.id, "ip")), normalizedUserAgent: "[retention-erased]" } });
  return { orders: orders.length, consents: consents.length };
}
