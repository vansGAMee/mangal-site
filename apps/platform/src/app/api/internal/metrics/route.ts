import { secureTokenEquals } from "@/server/crypto/envelope";
import { db } from "@/server/shared/db";
import { metricsRegistry, outboxBacklog, reconciliationBacklog, refundBacklog, unknownAttempts } from "@/server/observability/metrics";
export async function GET(request: Request): Promise<Response> {
  const token = process.env.INTERNAL_JOBS_TOKEN;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !provided || !secureTokenEquals(token, provided)) return new Response(null, { status: 401 });
  const [unknown,outbox,reconciliation,refunds]=await Promise.all([db.paymentAttempt.count({where:{status:"UNKNOWN"}}),db.outboxEvent.count({where:{status:"PENDING"}}),db.paymentReconciliationTask.count({where:{status:"PENDING"}}),db.refund.count({where:{status:{in:["CREATED","PROCESSING","UNKNOWN"]}}})]);unknownAttempts.set(unknown);outboxBacklog.set(outbox);reconciliationBacklog.set(reconciliation);refundBacklog.set(refunds);return new Response(await metricsRegistry.metrics(),{headers:{"Content-Type":metricsRegistry.contentType,"Cache-Control":"no-store"}});
}
