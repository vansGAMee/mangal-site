import { db } from "../../shared/db";
import { sha256 } from "../../shared/hash";
import { applyVerifiedPaymentState } from "./apply-verified-state";
import { providerClient } from "./provider-factory";

export async function processYooKassaWebhook(payload: unknown, rawBody: string): Promise<void> {
  if (!payload || typeof payload !== "object") throw new WebhookVerificationError("invalid_payload");
  const event = payload as { event?: unknown; object?: { id?: unknown } };
  const externalPaymentId = typeof event.object?.id === "string" ? event.object.id : "";
  if (!externalPaymentId || typeof event.event !== "string") throw new WebhookVerificationError("invalid_payload");
  const fingerprint = sha256(`YOOKASSA:${event.event}:${externalPaymentId}`);
  const existing = await db.paymentWebhookEvent.findUnique({ where: { fingerprint } });
  if (existing?.processedAt) return;

  // YooKassa does not publish an HMAC webhook signature. Authenticity is established
  // by fetching the canonical payment object over authenticated API and reconciling it.
  const verifiedState = await providerClient("YOOKASSA").getState(externalPaymentId);
  const attempt = existing?.paymentAttemptId
    ? await db.paymentAttempt.findUniqueOrThrow({ where: { id: existing.paymentAttemptId } })
    : await resolveAttempt("YOOKASSA", externalPaymentId, verifiedState.orderId);
  if (!existing) await persistVerifiedWebhook({ provider: "YOOKASSA", fingerprint, externalPaymentId, paymentAttemptId: attempt.id, payloadHash: sha256(rawBody), providerStatus: verifiedState.providerStatus });
  else if (!existing.paymentAttemptId) await db.paymentWebhookEvent.update({ where: { fingerprint }, data: { paymentAttemptId: attempt.id } });
  await applyVerifiedPaymentState(attempt.id, verifiedState);
  await db.paymentWebhookEvent.update({ where: { fingerprint }, data: { processedAt: new Date() } });
}

export async function processTBankWebhook(payload: Record<string, unknown>, rawBody: string): Promise<void> {
  const paymentId = payload.PaymentId === undefined ? "" : String(payload.PaymentId);
  const orderId = typeof payload.OrderId === "string" ? payload.OrderId : "";
  const status = typeof payload.Status === "string" ? payload.Status : "";
  if (!paymentId || !orderId || !status) throw new WebhookVerificationError("invalid_payload");
  const fingerprint = sha256(`TBANK:${paymentId}:${status}`);
  const existing = await db.paymentWebhookEvent.findUnique({ where: { fingerprint } });
  if (existing?.processedAt) return;

  // Token verification is performed by the route before this function. GetState is
  // still mandatory: a valid callback alone is not trusted as the payment truth.
  const verifiedState = await providerClient("TBANK").getState(paymentId);
  const attempt = existing?.paymentAttemptId
    ? await db.paymentAttempt.findUniqueOrThrow({ where: { id: existing.paymentAttemptId } })
    : await resolveAttempt("TBANK", paymentId, verifiedState.orderId || orderId);
  if (!existing) await persistVerifiedWebhook({ provider: "TBANK", fingerprint, externalPaymentId: paymentId, paymentAttemptId: attempt.id, payloadHash: sha256(rawBody), providerStatus: verifiedState.providerStatus });
  else if (!existing.paymentAttemptId) await db.paymentWebhookEvent.update({ where: { fingerprint }, data: { paymentAttemptId: attempt.id } });
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
  return byOrder;
}

async function persistVerifiedWebhook(input: {
  provider: "YOOKASSA" | "TBANK";
  fingerprint: string;
  externalPaymentId: string;
  paymentAttemptId: string;
  payloadHash: string;
  providerStatus: string;
}): Promise<void> {
  await db.paymentWebhookEvent.create({ data: { ...input, verified: true } }).catch(async () => {
    if (!(await db.paymentWebhookEvent.findUnique({ where: { fingerprint: input.fingerprint } }))) {
      throw new Error("webhook_persist_failed");
    }
  });
}

export class WebhookVerificationError extends Error {
  constructor(readonly code: string) {
    super("Webhook verification failed");
  }
}
