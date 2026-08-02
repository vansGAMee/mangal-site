import { z } from "zod";
import { validateAdminMutation } from "@/server/admin/auth";
import { slugify } from "@/server/catalog/menu-import";
import { readJsonBody, requestId } from "@/server/security/http";
import { db } from "@/server/shared/db";

const CreateCategory = z.object({
  name: z.string().trim().min(1).max(120),
  position: z.number().int().nonnegative(),
}).strict();

export async function POST(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const admin = await validateAdminMutation(request);
    const parsed = CreateCategory.safeParse(await readJsonBody(request));
    if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
    const slug = slugify(parsed.data.name);
    if (await db.category.findUnique({ where: { slug } })) {
      return Response.json({ error: "category_exists" }, { status: 409 });
    }
    const category = await db.$transaction(async (tx) => {
      const created = await tx.category.create({ data: { ...parsed.data, slug } });
      await tx.adminAuditLog.create({
        data: {
          adminUserId: admin.id,
          action: "CATEGORY_CREATED",
          targetType: "Category",
          targetId: created.id,
          metadata: { slug },
          requestId: id,
        },
      });
      return created;
    });
    return Response.json(category, { status: 201 });
  } catch {
    return new Response(null, { status: 403 });
  }
}
