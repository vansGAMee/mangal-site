import { randomUUID } from "node:crypto";
import type { AuthenticatedAdmin } from "../admin/auth";
import { db } from "../shared/db";

export class OrderMutationError extends Error {
  constructor(readonly code: "not_found" | "version_conflict" | "invalid_transition" | "payment_pending") { super(code); }
}

export async function requestOrderCancellation(input: { orderId: string; version: number; reason: string; admin: AuthenticatedAdmin; requestId: string }) {
  if (!input.reason.trim()) throw new OrderMutationError("invalid_transition");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${input.orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { paymentAttempts: { orderBy: { createdAt: "desc" } } } });
    if (!order) throw new OrderMutationError("not_found");
    if (order.version !== input.version) throw new OrderMutationError("version_conflict");
    if (["CANCELED", "COMPLETED", "CANCEL_REQUESTED"].includes(order.fulfillmentStatus)) throw new OrderMutationError("invalid_transition");
    if (order.paymentStatus === "PENDING") throw new OrderMutationError("payment_pending");

    if (order.paymentStatus === "PAID") {
      const attempt = order.paymentAttempts.find((item) => item.status === "SUCCEEDED" && item.externalPaymentId);
      if (!attempt) throw new OrderMutationError("invalid_transition");
      const existing = await tx.refund.findFirst({ where: { orderId: order.id, status: { in: ["CREATED", "PROCESSING", "UNKNOWN", "SUCCEEDED"] } } });
      if (existing) return { asynchronous: true, refundId: existing.id };
      const refundId = randomUUID();
      await tx.refund.create({ data: { id: refundId, orderId: order.id, paymentAttemptId: attempt.id, amountKopecks: order.totalKopecks, currency: "RUB", reason: input.reason.trim(), idempotencyKey: `refund:${refundId}`, createdByAdminId: input.admin.id } });
      await tx.order.update({ where: { id: order.id }, data: { fulfillmentStatus: "CANCEL_REQUESTED", paymentStatus: "REFUND_PENDING", version: { increment: 1 } } });
      await tx.outboxEvent.create({ data: { type: "REFUND_PAYMENT", aggregateType: "Refund", aggregateId: refundId, payload: { refundId } } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, fulfillmentStatus: "CANCEL_REQUESTED", paymentStatus: "REFUND_PENDING", actorType: "ADMIN", actorId: input.admin.id, reasonCode: "ADMIN_CANCELLATION" } });
      await tx.adminAuditLog.create({ data: { adminUserId: input.admin.id, orderId: order.id, action: "ORDER_REFUND_REQUESTED", targetType: "Order", targetId: order.id, metadata: { reason: input.reason.trim(), refundId }, requestId: input.requestId } });
      return { asynchronous: true, refundId };
    }

    await tx.order.update({ where: { id: order.id }, data: { fulfillmentStatus: "CANCELED", version: { increment: 1 } } });
    await tx.orderStatusHistory.create({ data: { orderId: order.id, fulfillmentStatus: "CANCELED", paymentStatus: order.paymentStatus, actorType: "ADMIN", actorId: input.admin.id, reasonCode: "ADMIN_CANCELLATION" } });
    await tx.adminAuditLog.create({ data: { adminUserId: input.admin.id, orderId: order.id, action: "ORDER_CANCELED", targetType: "Order", targetId: order.id, metadata: { reason: input.reason.trim() }, requestId: input.requestId } });
    return { asynchronous: false, refundId: null };
  });
}
