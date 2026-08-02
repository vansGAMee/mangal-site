import { z } from "zod";
import { validateAdminMutation } from "@/server/admin/auth";
import { readJsonBody, requestId } from "@/server/security/http";
import { db } from "@/server/shared/db";

const Schema = z.object({ name: z.string().trim().min(1).max(120), position: z.number().int().nonnegative(), isActive: z.boolean() }).strict();

export async function PATCH(request: Request, context: { params: Promise<{ categoryId: string }> }): Promise<Response> {
  const id = requestId(request);
  try {
    const admin = await validateAdminMutation(request);
    const parsed = Schema.safeParse(await readJsonBody(request));
    if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
    const { categoryId } = await context.params;
    const category = await db.$transaction(async (tx) => {
      const updated = await tx.category.update({ where: { id: categoryId }, data: parsed.data });
      await tx.adminAuditLog.create({
        data: {
          adminUserId: admin.id,
          action: "CATEGORY_UPDATED",
          targetType: "Category",
          targetId: categoryId,
          metadata: { changedFields: ["name", "position", "isActive"] },
          requestId: id,
        },
      });
      return updated;
    });
    return Response.json(category);
  } catch {
    return new Response(null, { status: 403 });
  }
}
