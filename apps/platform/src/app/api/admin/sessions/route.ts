import { z } from "zod";
import { authenticateAdminRequest, requireRole, validateAdminMutation } from "@/server/admin/auth";
import { readJsonBody, requestId } from "@/server/security/http";
import { db } from "@/server/shared/db";

const Revoke = z.object({ sessionId: z.string().uuid() }).strict();

export async function GET(request: Request): Promise<Response> {
  try {
    const admin = await authenticateAdminRequest(request);
    requireRole(admin, ["ADMIN"]);
    const now = new Date();
    const sessions = await db.adminSession.findMany({
      where: { revokedAt: null, idleExpiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
      orderBy: { lastSeenAt: "desc" },
      take: 200,
      select: { id: true, adminUserId: true, lastSeenAt: true, idleExpiresAt: true, absoluteExpiresAt: true, createdAt: true, adminUser: { select: { emailNormalized: true, role: true } } },
    });
    return Response.json(sessions.map((session) => ({ ...session, current: session.id === admin.sessionId })), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 403 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const admin = await validateAdminMutation(request);
    requireRole(admin, ["ADMIN"]);
    const parsed = Revoke.safeParse(await readJsonBody(request));
    if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
    const session = await db.adminSession.findUnique({ where: { id: parsed.data.sessionId } });
    if (!session) return new Response(null, { status: 404 });
    await db.$transaction([
      db.adminSession.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      db.adminAuditLog.create({
        data: {
          adminUserId: admin.id,
          action: "ADMIN_SESSION_REVOKED",
          targetType: "AdminSession",
          targetId: session.id,
          metadata: { revokedOwnSession: session.id === admin.sessionId, targetAdminUserId: session.adminUserId },
          requestId: id,
        },
      }),
    ]);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 403 });
  }
}
