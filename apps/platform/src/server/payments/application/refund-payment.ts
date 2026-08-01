import { associatedData, PiiCipher } from "../../crypto/envelope";
import { db } from "../../shared/db";
import { runtimeEnv } from "../../shared/env";
import { sha256, stableJson } from "../../shared/hash";
import { ProviderRejectedError, ProviderUnknownResultError, type ReceiptItem } from "../domain/provider";
import { providerClient } from "./provider-factory";

export async function processRefund(refundId: string): Promise<void> {
  const claimed = await db.refund.updateMany({ where: { id: refundId, status: { in: ["CREATED", "UNKNOWN"] } }, data: { status: "PROCESSING" } });
  if (!claimed.count) return;
  const refund = await db.refund.findUniqueOrThrow({
    where: { id: refundId },
    include: { paymentAttempt: true, order: { include: { items: { include: { fiscalSnapshot: true } } } } },
  });
  if (!refund.paymentAttempt.externalPaymentId) return markUnknown(refund.id, "payment_id_missing");
  const receipt = buildRefundReceipt(refund.order);
  const client = providerClient(refund.paymentAttempt.provider);
  const operation = await db.paymentOperation.create({ data: { paymentAttemptId: refund.paymentAttemptId, type: "REFUND", status: "STARTED", requestHash: sha256(stableJson({ refundId: refund.id, paymentId: refund.paymentAttempt.externalPaymentId, amountKopecks: refund.amountKopecks, currency: "RUB" })) } });
  const started = performance.now();
  try {
    const result = await client.refund({
      refundId: refund.id,
      idempotencyKey: refund.idempotencyKey,
      externalPaymentId: refund.paymentAttempt.externalPaymentId,
      amountKopecks: refund.amountKopecks,
      currency: "RUB",
      receipt,
    });
    await db.paymentOperation.update({ where: { id: operation.id }, data: { status: "SUCCEEDED", responseHash: sha256(stableJson(result)), durationMs: Math.round(performance.now() - started), completedAt: new Date() } });
    if (result.state === "SUCCEEDED") await finalizeRefund(refund.id, result.externalRefundId, result.providerStatus);
    else if (result.state === "FAILED") await markReview(refund.id, result.externalRefundId, result.providerStatus);
    else await db.refund.update({ where: { id: refund.id }, data: { status: "UNKNOWN", externalRefundId: result.externalRefundId } });
  } catch (error) {
    await db.paymentOperation.update({ where: { id: operation.id }, data: { status: error instanceof ProviderUnknownResultError ? "UNKNOWN" : "FAILED", errorCode: error instanceof ProviderUnknownResultError || error instanceof ProviderRejectedError ? error.safeCode : "internal_error", durationMs: Math.round(performance.now() - started), completedAt: new Date() } });
    if (error instanceof ProviderUnknownResultError) return markUnknown(refund.id, error.safeCode);
    if (error instanceof ProviderRejectedError) return markReview(refund.id, undefined, error.safeCode);
    return markUnknown(refund.id, "internal_error");
  }
}

export async function reconcileRefund(refundId: string): Promise<void> {
  const refund = await db.refund.findUniqueOrThrow({ where: { id: refundId }, include: { paymentAttempt: true } });
  if (!refund.externalRefundId || !refund.paymentAttempt.externalPaymentId) return processRefund(refundId);
  try {
    const result = await providerClient(refund.paymentAttempt.provider).getRefundState(refund.externalRefundId, refund.paymentAttempt.externalPaymentId);
    if (result.state === "SUCCEEDED") await finalizeRefund(refund.id, result.externalRefundId, result.providerStatus);
    else if (result.state === "FAILED") await markReview(refund.id, result.externalRefundId, result.providerStatus);
  } catch (error) {
    if (!(error instanceof ProviderUnknownResultError)) await db.refund.update({ where: { id: refund.id }, data: { failureCode: "reconciliation_error" } });
  }
}

function buildRefundReceipt(order: { id: string; phoneEncrypted: unknown; emailEncrypted: unknown; taxSystemSnapshot: string; deliveryFeeKopecks: number; items: Array<{ fiscalSnapshot: { fiscalName: string; quantity: number; amountKopecks: number; unitPriceKopecks: number; vatCode: string; taxSystemCode: string; paymentSubject: string; paymentMode: string; measure: string } | null }> }) {
  const env = runtimeEnv();
  if (!env.PII_KEY_RING_JSON) throw new Error("PII encryption is unavailable");
  const cipher = new PiiCipher(env.PII_KEY_RING_JSON);
  const phone = cipher.decrypt(order.phoneEncrypted, associatedData(order.id, "phone")).plaintext;
  const email = order.emailEncrypted ? cipher.decrypt(order.emailEncrypted, associatedData(order.id, "email")).plaintext : undefined;
  const items: ReceiptItem[] = order.items.map(({ fiscalSnapshot }) => {
    if (!fiscalSnapshot) throw new Error("Fiscal snapshot is unavailable");
    return { name: fiscalSnapshot.fiscalName, quantity: fiscalSnapshot.quantity, amountKopecks: fiscalSnapshot.amountKopecks, unitPriceKopecks: fiscalSnapshot.unitPriceKopecks, vatCode: fiscalSnapshot.vatCode, taxSystemCode: fiscalSnapshot.taxSystemCode, paymentSubject: fiscalSnapshot.paymentSubject, paymentMode: fiscalSnapshot.paymentMode, measure: fiscalSnapshot.measure };
  });
  if (order.deliveryFeeKopecks > 0) {
    const fiscal = [process.env.FISCAL_DELIVERY_VAT_CODE, process.env.FISCAL_DELIVERY_PAYMENT_SUBJECT, process.env.FISCAL_DELIVERY_PAYMENT_MODE, process.env.FISCAL_DELIVERY_MEASURE];
    if (fiscal.some((value) => !value)) throw new Error("Delivery fiscal configuration is unavailable");
    items.push({ name: "Доставка", quantity: 1, amountKopecks: order.deliveryFeeKopecks, unitPriceKopecks: order.deliveryFeeKopecks, vatCode: fiscal[0]!, taxSystemCode: order.taxSystemSnapshot, paymentSubject: fiscal[1]!, paymentMode: fiscal[2]!, measure: fiscal[3]! });
  }
  return { customer: email ? { phone, email } : { phone }, taxSystemCode: order.taxSystemSnapshot, items };
}

async function finalizeRefund(refundId: string, externalRefundId: string, providerStatus: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Refund" WHERE id = ${refundId}::uuid FOR UPDATE`;
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId }, include: { order: true } });
    if (refund.status === "SUCCEEDED") return;
    await tx.refund.update({ where: { id: refundId }, data: { status: "SUCCEEDED", externalRefundId, failureCode: null, completedAt: new Date() } });
    await tx.order.update({ where: { id: refund.orderId }, data: { paymentStatus: "REFUNDED", fulfillmentStatus: "CANCELED", version: { increment: 1 } } });
    await tx.orderStatusHistory.create({ data: { orderId: refund.orderId, paymentStatus: "REFUNDED", fulfillmentStatus: "CANCELED", actorType: "PAYMENT_PROVIDER", reasonCode: providerStatus } });
  });
}

async function markUnknown(refundId: string, safeCode: string): Promise<void> { await db.refund.update({ where: { id: refundId }, data: { status: "UNKNOWN", failureCode: safeCode } }); }
async function markReview(refundId: string, externalRefundId: string | undefined, safeCode: string): Promise<void> { await db.refund.update({ where: { id: refundId }, data: { status: "REVIEW_REQUIRED", failureCode: safeCode, ...(externalRefundId ? { externalRefundId } : {}) } }); }
