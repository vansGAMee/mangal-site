import { NextResponse } from "next/server";
import { db } from "@/server/shared/db";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { clientIp, corsHeaders, requestId, validateStorefrontOrigin } from "@/server/security/http";

export function OPTIONS(request: Request): Response {
  const origin = validateStorefrontOrigin(request);
  return origin ? new Response(null, { status: 204, headers: corsHeaders(origin, "GET, OPTIONS") }) : new Response(null, { status: 403 });
}

export async function GET(request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> {
  const id = requestId(request);
  const origin = validateStorefrontOrigin(request);
  if (!origin) return new Response(null, { status: 403 });
  const { publicId } = await context.params;
  if (!/^MGL-[A-F0-9]{12}$/.test(publicId)) return new Response(null, { status: 404, headers: corsHeaders(origin, "GET, OPTIONS") });
  if (!(await consumeRateLimit(clientIp(request), "public_order_status", 60, 60_000))) {
    return new Response(null, { status: 429, headers: { ...corsHeaders(origin, "GET, OPTIONS"), "Retry-After": "60" } });
  }
  const order = await db.order.findUnique({
    where: { publicId },
    select: {
      publicId: true,
      paymentStatus: true,
      fulfillmentStatus: true,
      updatedAt: true,
    },
  });
  if (!order) return NextResponse.json({ error: { code: "not_found", requestId: id } }, { status: 404, headers: corsHeaders(origin, "GET, OPTIONS") });
  return NextResponse.json(order, { headers: { ...corsHeaders(origin, "GET, OPTIONS"), "Cache-Control": "no-store", "X-Request-Id": id } });
}
