import { NextResponse } from "next/server";
import { getPublicCatalog } from "@/server/catalog/public-catalog";
import { requestId } from "@/server/security/http";

export async function GET(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  const catalog = await getPublicCatalog();
  return NextResponse.json(catalog, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
      "X-Request-Id": id,
    },
  });
}
