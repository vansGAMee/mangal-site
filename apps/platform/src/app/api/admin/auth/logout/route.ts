import { expiredSessionCookies, revokeSession, validateAdminMutation } from "@/server/admin/auth";

export async function POST(request: Request): Promise<Response> {
  try { await validateAdminMutation(request); await revokeSession(request); } catch { return new Response(null, { status: 403 }); }
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const cookie of expiredSessionCookies()) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 204, headers });
}
