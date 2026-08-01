import { runtimeEnv } from "@/server/shared/env";
import { processTBankWebhook, WebhookVerificationError } from "@/server/payments/application/webhooks";
import { verifyTBankToken } from "@/server/payments/infrastructure/tbank/token";
import { BodyTooLargeError, MAX_WEBHOOK_BODY_BYTES, readLimitedBody, requestId } from "@/server/security/http";
import { webhookVerificationFailures } from "@/server/observability/metrics";

export async function POST(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const raw = await readLimitedBody(request, MAX_WEBHOOK_BODY_BYTES);
    const payload = JSON.parse(raw) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new WebhookVerificationError("invalid_payload");
    const password = runtimeEnv().TBANK_PASSWORD;
    if (!password || !verifyTBankToken(payload as Record<string, unknown>, password)) {
      throw new WebhookVerificationError("invalid_token");
    }
    await processTBankWebhook(payload as Record<string, unknown>, raw);
    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Request-Id": id, "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof WebhookVerificationError) webhookVerificationFailures.inc({ provider: "TBANK" });
    const status = error instanceof BodyTooLargeError ? 413 : error instanceof WebhookVerificationError || error instanceof SyntaxError ? 400 : 503;
    return new Response("", { status, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Request-Id": id } });
  }
}
