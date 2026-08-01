import { CheckoutRequestSchema } from "@mangal/contracts";
import { NextResponse } from "next/server";
import { checkout, CheckoutError } from "@/server/checkout/service";
import { consumeRateLimit } from "@/server/security/rate-limit";
import {
  apiError,
  BodyTooLargeError,
  clientIp,
  corsHeaders,
  MAX_CHECKOUT_BODY_BYTES,
  normalizeUserAgent,
  readLimitedBody,
  requestId,
  validateStorefrontOrigin,
} from "@/server/security/http";
import { catalogChanged, checkoutResults } from "@/server/observability/metrics";

export async function OPTIONS(request: Request): Promise<Response> {
  const origin = validateStorefrontOrigin(request);
  if (!origin) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: Request): Promise<Response> {
  const id = requestId(request);
  const origin = validateStorefrontOrigin(request);
  if (!origin) return apiError("forbidden", 403, id, "Origin не разрешён");
  const ip = clientIp(request);
  if (!(await consumeRateLimit(ip, "checkout", 8, 60_000))) {
    const response = apiError("rate_limited", 429, id, "Слишком много запросов");
    for (const [name, value] of Object.entries(corsHeaders(origin))) response.headers.set(name, String(value));
    return response;
  }
  try {
    const parsedJson = JSON.parse(await readLimitedBody(request, MAX_CHECKOUT_BODY_BYTES)) as unknown;
    const parsed = CheckoutRequestSchema.safeParse(parsedJson);
    if (!parsed.success) return withCors(apiError("validation", 400, id, "Проверьте поля заказа"), origin);
    const result = await checkout(parsed.data, {
      ip,
      userAgent: normalizeUserAgent(request.headers.get("user-agent")),
    });
    checkoutResults.inc({ result: "success" });
    return NextResponse.json(result, {
      status: 201,
      headers: { ...corsHeaders(origin), "Cache-Control": "no-store", "X-Request-Id": id },
    });
  } catch (error) {
    if (error instanceof CheckoutError) { checkoutResults.inc({ result: error.code }); if (error.code === "catalog_changed") catalogChanged.inc(); return withCors(apiError(error.code, error.status, id, error.message), origin); }
    if (error instanceof BodyTooLargeError || error instanceof SyntaxError) {
      return withCors(apiError("validation", 400, id, "Некорректное тело запроса"), origin);
    }
    return withCors(apiError("store_not_configured", 500, id, "Оформление временно недоступно"), origin);
  }
}

function withCors(response: NextResponse, origin: string): NextResponse {
  for (const [name, value] of Object.entries(corsHeaders(origin))) response.headers.set(name, String(value));
  return response;
}
