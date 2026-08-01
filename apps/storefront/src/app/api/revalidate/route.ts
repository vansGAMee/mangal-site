import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

export async function POST(request: Request): Promise<Response> {
  const configured = process.env.STOREFRONT_REVALIDATE_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || !safeEqual(configured, supplied)) return new Response(null, { status: 401 });
  revalidateTag("catalog", "max");
  return Response.json({ revalidated: true, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
