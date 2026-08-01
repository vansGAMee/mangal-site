import { db } from "../../shared/db";
import { sha256, stableJson } from "../../shared/hash";
import { applyVerifiedPaymentState } from "./apply-verified-state";
import { providerClient } from "./provider-factory";

export async function processYooKassaWebhook(payload: unknown, rawBody: string): Promise<void> {
  if (!payload || typeof payload !== "object") throw new WebhookVerificationError("invalid_payload");
  const event = payload as { event?: unknown; object?: { id?: unknown } };
  const externalPaymentId = typeof event.object?.id === "string" ? event.object.id : "";
  if (!externalPaymentId || typeof event.event !== "string") throw new WebhookVerificationError("invalid_payload");
  const fingerprint = sha256(`YOOKASSA:${event.event}:${externalPaymentId}:${sha256(rawBody)}`);
  if (await db.paymentWebhookEvent.findUnique({ where: { fingerprint } })) return;

  // YooKassa does not publish an HMAC webhook signature. Authenticity is established
  // by fetching the canonical payment object over authenticated API and reconciling it.
  const verifiedState = await providerClient("YOOKASSA").getState(externalPaymentId);
  const attempt = await resolveAttempt("YOOKASSA", externalPaymentId, verifiedState.orderId);
  await db.paymentWebhookEvent.create({
    data: {
      provider: "YOOKASSA",
      fingerprint,
      externalPaymentId,
      paymentAttemptId: attempt.id,
      payloadHash: sha256(rawBody),
      providerStatus: verifiedState.providerStatus,
      verified: true,
    },
  }).catch(async () => {
    if (!(await db.paymentWebhookEvent.findUnique({ where: { fingerprint } }))) throw new Error("webhook_persist_failed");
  });
  await applyVerifiedPaymentState(attempt.id, verifiedState);
  await db.paymentWebhookEvent.update({ where: { fingerprint }, data: { processedAt: new Date() } });
}

export async function processTBankWebhook(payload: Record<string, unknown>, rawBody: string): Promise<void> {
  const paymentId = payload.PaymentId === undefined ? "" : String(payload.PaymentId);
  const orderId = typeof payload.OrderId === "string" ? payload.OrderId : "";
  const status = typeof payload.Status === "string" ? payload.Status : "";
  if (!paymentId || !orderId || !status) throw new WebhookVerificationError("invalid_payload");
  const fingerprint = sha256(`TBANK:${paymentId}:${status}:${sha256(stableJson(payload))}`);
  if (await db.paymentWebhookEvent.findUnique({ where: { fingerprint } })) return;

  // Token verification is performed by the route before this function. GetState is
  // still mandatory: a valid callback alone is not trusted as the payment truth.
  const verifiedState = await providerClient("TBANK").getState(paymentId);
  const attempt = await resolveAttempt("TBANK", paymentId, verifiedState.orderId || orderId);
  await db.paymentWebhookEvent.create({
    data: {
      provider: "TBANK",
      fingerprint,
      externalPaymentId: paymentId,
      paymentAttemptId: attempt.id,
      payloadHash: sha256(rawBody),
      providerStatus: verifiedState.providerStatus,
      verified: true,
    },
  }).catch(async () => {
    if (!(await db.paymentWebhookEvent.findUnique({ where: { fingerprint } }))) throw new Error("webhook_persist_failed");
  });
  await applyVerifiedPaymentState(attempt.id, verifiedState);
  await db.paymentWebhookEvent.update({ where: { fingerprint }, data: { processedAt: new Date() } });
}

async function resolveAttempt(provider: "YOOKASSA" | "TBANK", externalPaymentId: string, orderId: string) {
  const byExternal = await db.paymentAttempt.findFirst({ where: { provider, externalPaymentId } });
  if (byExternal) return byExternal;
  const byOrder = await db.paymentAttempt.findFirst({
    where: { provider, orderId },
    orderBy: { createdAt: "desc" },
  });
  if (!byOrder) throw new WebhookVerificationError("attempt_not_found");
  await db.paymentAttempt.updateMany({
    where: { id: byOrder.id, externalPaymentId: null },
    data: { externalPaymentId },
  });
  return { ...byOrder, externalPaymentId };
}

export class WebhookVerificationError extends Error {
  constructor(readonly code: string) {
    super("Webhook verification failed");
  }
}
