import { z } from "zod";
import { authenticateAdminRequest, hashAdminPassword, requireRole, validateAdminMutation } from "@/server/admin/auth";
import { readJsonBody, requestId } from "@/server/security/http";
import { db } from "@/server/shared/db";

const Create = z.object({
  email: z.string().email().max(254),
  password: z.string().min(14).max(256),
  role: z.literal("MANAGER"),
  refundPermission: z.boolean(),
}).strict();
const Update = z.object({ userId: z.string().uuid(), isActive: z.boolean(), refundPermission: z.boolean() }).strict();

export async function GET(request: Request): Promise<Response> {
  try {
    const admin = await authenticateAdminRequest(request);
    requireRole(admin, ["ADMIN"]);
    return Response.json(await db.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, emailNormalized: true, role: true, isActive: true, mfaEnrolledAt: true, createdAt: true, permissions: true },
    }), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 403 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const admin = await validateAdminMutation(request);
    requireRole(admin, ["ADMIN"]);
    const parsed = Create.safeParse(await readJsonBody(request));
    if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
    const user = await db.$transaction(async (tx) => {
      const created = await tx.adminUser.create({
        data: {
          emailNormalized: parsed.data.email.trim().toLowerCase(),
          passwordHash: await hashAdminPassword(parsed.data.password),
          role: "MANAGER",
          mfaRequired: false,
          ...(parsed.data.refundPermission ? { permissions: { create: { code: "REFUND_ORDER" } } } : {}),
        },
      });
      await tx.adminAuditLog.create({
        data: {
          adminUserId: admin.id,
          action: "ADMIN_USER_CREATED",
          targetType: "AdminUser",
          targetId: created.id,
          metadata: { role: "MANAGER", refundPermission: parsed.data.refundPermission },
          requestId: id,
        },
      });
      return { id: created.id, email: created.emailNormalized, role: created.role };
    });
    return Response.json(user, { status: 201 });
  } catch {
    return new Response(null, { status: 403 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const admin = await validateAdminMutation(request);
    requireRole(admin, ["ADMIN"]);
    const parsed = Update.safeParse(await readJsonBody(request));
    if (!parsed.success || parsed.data.userId === admin.id) return Response.json({ error: "validation" }, { status: 400 });
    const target = await db.adminUser.findUnique({ where: { id: parsed.data.userId } });
    if (!target) return new Response(null, { status: 404 });
    if (target.role !== "MANAGER") return Response.json({ error: "admin_user_protected" }, { status: 409 });
    await db.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id: target.id }, data: { isActive: parsed.data.isActive } });
      if (parsed.data.refundPermission) {
        await tx.adminPermission.upsert({
          where: { adminUserId_code: { adminUserId: target.id, code: "REFUND_ORDER" } },
          create: { adminUserId: target.id, code: "REFUND_ORDER" },
          update: {},
        });
      } else {
        await tx.adminPermission.deleteMany({ where: { adminUserId: target.id, code: "REFUND_ORDER" } });
      }
      if (!parsed.data.isActive) {
        await tx.adminSession.updateMany({ where: { adminUserId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await tx.adminAuditLog.create({
        data: {
          adminUserId: admin.id,
          action: "ADMIN_USER_UPDATED",
          targetType: "AdminUser",
          targetId: target.id,
          metadata: { isActive: parsed.data.isActive, refundPermission: parsed.data.refundPermission },
          requestId: id,
        },
      });
    });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 403 });
  }
}
