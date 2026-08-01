import { z } from "zod";
import { grantRoutingReauth, requireRole, validateAdminMutation } from "@/server/admin/auth";
const Schema = z.object({ password: z.string().min(1).max(256), totpCode: z.string().regex(/^\d{6}$/) });
export async function POST(request: Request): Promise<Response> { try { const admin = await validateAdminMutation(request); requireRole(admin, ["ADMIN"]); const parsed = Schema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 }); return Response.json({ nonce: await grantRoutingReauth(admin, parsed.data.password, parsed.data.totpCode) }); } catch { return new Response(null, { status: 403 }); } }
