import { processYooKassaWebhook, WebhookVerificationError } from "@/server/payments/application/webhooks";
import { BodyTooLargeError, MAX_WEBHOOK_BODY_BYTES, readLimitedBody, requestId } from "@/server/security/http";
import { webhookVerificationFailures } from "@/server/observability/metrics";

export async function POST(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const raw = await readLimitedBody(request, MAX_WEBHOOK_BODY_BYTES);
    await processYooKassaWebhook(JSON.parse(raw) as unknown, raw);
    return new Response(null, { status: 200, headers: { "X-Request-Id": id, "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof WebhookVerificationError) webhookVerificationFailures.inc({ provider: "YOOKASSA" });
    const status = error instanceof BodyTooLargeError ? 413 : error instanceof WebhookVerificationError || error instanceof SyntaxError ? 400 : 503;
    return new Response(null, { status, headers: { "X-Request-Id": id, "Cache-Control": "no-store" } });
  }
}
