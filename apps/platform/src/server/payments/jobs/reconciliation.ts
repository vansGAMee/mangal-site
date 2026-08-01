import { db } from "../../shared/db";
import { applyVerifiedPaymentState } from "../application/apply-verified-state";
import { initializePaymentAttempt } from "../application/initialize-payment";
import { reconcileRefund } from "../application/refund-payment";
import { queryPaymentState } from "../application/query-state";

export async function runReconciliationBatch(limit = 50): Promise<{ attempts: number; refunds: number }> {
  const staleInitializing = new Date(Date.now() - 2 * 60_000);
  const staleProcessing = new Date(Date.now() - 10 * 60_000);
  const attempts = await db.paymentAttempt.findMany({
    where: { OR: [{ status: "UNKNOWN" }, { status: "INITIALIZING", updatedAt: { lt: staleInitializing } }, { status: "PROCESSING", updatedAt: { lt: staleProcessing } }] },
    orderBy: { updatedAt: "asc" }, take: limit,
  });
  for (const attempt of attempts) {
    try {
      if (!attempt.externalPaymentId) await initializePaymentAttempt(attempt.id);
      else await applyVerifiedPaymentState(attempt.id, await queryPaymentState(attempt));
      await db.paymentReconciliationTask.updateMany({ where: { paymentAttemptId: attempt.id, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "RESOLVED", leaseOwner: null, leaseExpiresAt: null } });
    } catch {
      const existing = await db.paymentReconciliationTask.findFirst({ where: { paymentAttemptId: attempt.id, status: { in: ["PENDING", "PROCESSING"] } } });
      if (!existing) await db.paymentReconciliationTask.create({ data: { paymentAttemptId: attempt.id, reason: "reconciliation_retry", attempts: 1, availableAt: new Date(Date.now() + 60_000) } });
      else await db.paymentReconciliationTask.update({ where: { id: existing.id }, data: { attempts: { increment: 1 }, availableAt: new Date(Date.now() + 60_000), status: existing.attempts >= 11 ? "REVIEW_REQUIRED" : "PENDING" } });
    }
  }
  const refunds = await db.refund.findMany({ where: { status: { in: ["CREATED", "PROCESSING", "UNKNOWN"] } }, orderBy: { updatedAt: "asc" }, take: limit });
  for (const refund of refunds) await reconcileRefund(refund.id);
  await reconcileConflictingOrders(limit);
  return { attempts: attempts.length, refunds: refunds.length };
}

async function reconcileConflictingOrders(limit: number): Promise<void> {
  const orders = await db.order.findMany({ where: { OR: [{ paymentStatus: "PAID", paymentAttempts: { none: { status: "SUCCEEDED" } } }, { paymentStatus: "REFUNDED", refunds: { none: { status: "SUCCEEDED" } } }] }, take: limit, select: { id: true } });
  for (const order of orders) {
    const existing = await db.systemNotification.findFirst({ where: { orderId: order.id, type: "PAYMENT_STATE_CONFLICT", status: "OPEN" } });
    if (!existing) await db.systemNotification.create({ data: { orderId: order.id, type: "PAYMENT_STATE_CONFLICT", status: "OPEN", payload: { orderId: order.id } } });
  }
}
