import type { OutboxEvent } from "../../../../../generated/prisma/client";
import { db } from "../shared/db";
import { initializePaymentAttempt } from "../payments/application/initialize-payment";
import { processRefund } from "../payments/application/refund-payment";

export async function processOutboxBatch(workerId: string, limit = 20): Promise<{ processed: number }> {
  const events = await claimEvents(workerId, limit);
  let processed = 0;
  for (const event of events) {
    try {
      if (event.type === "INITIATE_PAYMENT") await initializePaymentAttempt(event.aggregateId);
      else if (event.type === "REFUND_PAYMENT") await processRefund(event.aggregateId);
      else throw new Error("unsupported_event_type");
      await db.outboxEvent.update({ where: { id: event.id }, data: { status: "COMPLETED", completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null } });
      processed++;
    } catch (error) {
      const attempts = event.attempts + 1;
      const dead = attempts >= event.maxAttempts;
      await db.outboxEvent.update({ where: { id: event.id }, data: { attempts, status: dead ? "DEAD_LETTER" : "PENDING", availableAt: new Date(Date.now() + Math.min(60 * 60_000, 2 ** attempts * 1_000)), leaseOwner: null, leaseExpiresAt: null, lastErrorCode: safeError(error) } });
    }
  }
  return { processed };
}

async function claimEvents(workerId: string, limit: number): Promise<OutboxEvent[]> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<OutboxEvent[]>`
      SELECT * FROM "OutboxEvent"
      WHERE status = 'PENDING' AND "availableAt" <= now()
        AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" < now())
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED`;
    if (!rows.length) return [];
    await tx.outboxEvent.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { status: "PROCESSING", leaseOwner: workerId, leaseExpiresAt: new Date(Date.now() + 60_000) } });
    return rows;
  });
}

function safeError(error: unknown): string { return error instanceof Error ? error.name.slice(0, 80) : "unknown_error"; }
