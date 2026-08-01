import { readiness } from "@/server/health/checks";
export async function GET(): Promise<Response> { const result = await readiness(); return Response.json(result, { status: result.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } }); }
