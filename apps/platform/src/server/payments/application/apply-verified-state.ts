import type { ProviderPaymentState } from "../domain/provider";
import { db } from "../../shared/db";
import { nextAttemptStatus, nextOrderPaymentStatus } from "../domain/transitions";

export class PaymentVerificationError extends Error {
  constructor(readonly code: "attempt_not_found" | "provider_mismatch" | "external_id_mismatch" | "amount_mismatch" | "currency_mismatch" | "order_mismatch") {
    super(code);
  }
}

export async function applyVerifiedPaymentState(attemptId: string, state: ProviderPaymentState): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PaymentAttempt" WHERE id = ${attemptId}::uuid FOR UPDATE`;
    const attempt = await tx.paymentAttempt.findUnique({ where: { id: attemptId }, include: { order: true } });
    if (!attempt) throw new PaymentVerificationError("attempt_not_found");
    if (attempt.provider !== state.provider) throw new PaymentVerificationError("provider_mismatch");
    if (attempt.externalPaymentId && attempt.externalPaymentId !== state.externalPaymentId) {
      throw new PaymentVerificationError("external_id_mismatch");
    }
    if (attempt.amountKopecks !== state.amountKopecks) throw new PaymentVerificationError("amount_mismatch");
    if (attempt.currency !== state.currency || state.currency !== "RUB") throw new PaymentVerificationError("currency_mismatch");
    if (attempt.orderId !== state.orderId) throw new PaymentVerificationError("order_mismatch");

    const attemptStatus = nextAttemptStatus(attempt.status, state.state);
    const paymentStatus = nextOrderPaymentStatus(attempt.order.paymentStatus, state.state);
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        externalPaymentId: state.externalPaymentId,
        status: attemptStatus,
        lastProviderStatus: state.providerStatus,
        lastCheckedAt: new Date(),
      },
    });
    if (paymentStatus !== attempt.order.paymentStatus) {
      await tx.order.update({
        where: { id: attempt.orderId },
        data: { paymentStatus, version: { increment: 1 } },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: attempt.orderId,
          paymentStatus,
          fulfillmentStatus: attempt.order.fulfillmentStatus,
          actorType: "PAYMENT_PROVIDER",
          reasonCode: state.providerStatus,
        },
      });
    }
  });
}
