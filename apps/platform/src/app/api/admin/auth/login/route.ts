import { z } from "zod";
import { loginAdmin, sessionCookies, AdminAuthError } from "@/server/admin/auth";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { clientIp, requestId } from "@/server/security/http";

const LoginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256), mfaCode: z.string().trim().max(32).optional() });

export async function POST(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const adminOrigin = process.env.ADMIN_BASE_URL;
    const requestOrigin = request.headers.get("origin");
    if (adminOrigin && requestOrigin) {
      try {
        const allowed = new URL(adminOrigin).origin;
        if (requestOrigin !== allowed && requestOrigin !== new URL(request.url).origin) {
          return Response.json({ error: "origin" }, { status: 403 });
        }
      } catch {
        // ignore invalid ADMIN_BASE_URL
      }
    }
    
    const ip = clientIp(request);
    if (!(await consumeRateLimit(ip, "admin_login", 5, 15 * 60_000))) return Response.json({ error: "rate_limited" }, { status: 429 });

    const parsed = LoginSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
    const result = await loginAdmin(parsed.data.email, parsed.data.password, parsed.data.mfaCode);
    const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-Id": id });
    for (const cookie of sessionCookies(result.token, result.csrfToken)) headers.append("Set-Cookie", cookie);
    return new Response(JSON.stringify({ admin: result.admin }), { status: 200, headers });
  } catch (error) {
    console.error("Login Error:", error);
    const code = error instanceof AdminAuthError ? error.code : "unavailable";
    return Response.json({ error: code }, { status: code === "locked" ? 423 : code === "mfa_required" ? 401 : 401, headers: { "Cache-Control": "no-store", "X-Request-Id": id } });
  }
}
