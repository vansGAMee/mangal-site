import { z } from "zod";
import { authenticateAdminRequest, validateAdminMutation } from "@/server/admin/auth";
import { slugify } from "@/server/catalog/menu-import";
import { readJsonBody, requestId } from "@/server/security/http";
import { db } from "@/server/shared/db";

const Mutation = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("group"), id: z.string().uuid(), name: z.string().trim().min(1).max(120), required: z.boolean(), minSelect: z.number().int().nonnegative(), maxSelect: z.number().int().nonnegative().nullable(), isActive: z.boolean() }),
  z.object({ operation: z.literal("option"), id: z.string().uuid(), name: z.string().trim().min(1).max(120), priceDeltaKopecks: z.number().int().nonnegative(), isAvailable: z.boolean() }),
  z.object({ operation: z.literal("binding"), productId: z.string().uuid(), modifierGroupId: z.string().uuid(), enabled: z.boolean(), position: z.number().int().nonnegative() }),
]);

const Create = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("group"),
    name: z.string().trim().min(1).max(120),
    selectionMode: z.enum(["SINGLE", "MULTIPLE"]),
    required: z.boolean(),
    minSelect: z.number().int().nonnegative(),
    maxSelect: z.number().int().positive().nullable(),
    position: z.number().int().nonnegative(),
  }).strict(),
  z.object({
    operation: z.literal("option"),
    groupId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    priceDeltaKopecks: z.number().int().nonnegative(),
    position: z.number().int().nonnegative(),
  }).strict(),
]);

export async function GET(request: Request): Promise<Response> {
  try {
    await authenticateAdminRequest(request);
    return Response.json(await db.modifierGroup.findMany({
      orderBy: { position: "asc" },
      include: {
        options: { orderBy: { position: "asc" } },
        products: { include: { product: { select: { id: true, name: true, slug: true } } } },
      },
    }), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 401 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const admin = await validateAdminMutation(request);
    const parsed = Create.safeParse(await readJsonBody(request));
    if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
    if (parsed.data.operation === "group" && (
      (parsed.data.maxSelect !== null && parsed.data.maxSelect < parsed.data.minSelect)
      || (parsed.data.required && parsed.data.minSelect === 0)
    )) return Response.json({ error: "invalid_range" }, { status: 409 });
    const slug = slugify(parsed.data.name);
    const duplicate = parsed.data.operation === "group"
      ? await db.modifierGroup.findUnique({ where: { slug }, select: { id: true } })
      : await db.modifierOption.findUnique({ where: { groupId_slug: { groupId: parsed.data.groupId, slug } }, select: { id: true } });
    if (duplicate) return Response.json({ error: "modifier_exists" }, { status: 409 });
    const created = await db.$transaction(async (tx) => {
      if (parsed.data.operation === "group") {
        const group = await tx.modifierGroup.create({
          data: {
            slug,
            name: parsed.data.name,
            kind: "OTHER",
            selectionMode: parsed.data.selectionMode,
            required: parsed.data.required,
            minSelect: parsed.data.minSelect,
            maxSelect: parsed.data.maxSelect,
            position: parsed.data.position,
          },
        });
        await tx.adminAuditLog.create({
          data: { adminUserId: admin.id, action: "MODIFIER_GROUP_CREATED", targetType: "ModifierGroup", targetId: group.id, metadata: { slug }, requestId: id },
        });
        return group;
      }
      const group = await tx.modifierGroup.findUnique({ where: { id: parsed.data.groupId }, select: { id: true } });
      if (!group) return null;
      const option = await tx.modifierOption.create({
        data: {
          groupId: parsed.data.groupId,
          slug,
          name: parsed.data.name,
          priceDeltaKopecks: parsed.data.priceDeltaKopecks,
          position: parsed.data.position,
        },
      });
      await tx.adminAuditLog.create({
        data: { adminUserId: admin.id, action: "MODIFIER_OPTION_CREATED", targetType: "ModifierOption", targetId: option.id, metadata: { groupId: parsed.data.groupId, slug }, requestId: id },
      });
      return option;
    });
    return created ? Response.json(created, { status: 201 }) : Response.json({ error: "group_not_found" }, { status: 409 });
  } catch {
    return new Response(null, { status: 403 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const admin = await validateAdminMutation(request);
    const parsed = Mutation.safeParse(await readJsonBody(request));
    if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
    if (parsed.data.operation === "group" && (
      (parsed.data.maxSelect !== null && parsed.data.maxSelect < parsed.data.minSelect)
      || (parsed.data.required && parsed.data.minSelect === 0)
    )) return Response.json({ error: "invalid_range" }, { status: 409 });

    await db.$transaction(async (tx) => {
      if (parsed.data.operation === "group") {
        await tx.modifierGroup.update({
          where: { id: parsed.data.id },
          data: { name: parsed.data.name, required: parsed.data.required, minSelect: parsed.data.minSelect, maxSelect: parsed.data.maxSelect, isActive: parsed.data.isActive },
        });
      } else if (parsed.data.operation === "option") {
        await tx.modifierOption.update({
          where: { id: parsed.data.id },
          data: { name: parsed.data.name, priceDeltaKopecks: parsed.data.priceDeltaKopecks, isAvailable: parsed.data.isAvailable },
        });
      } else if (parsed.data.enabled) {
        await tx.productModifierGroup.upsert({
          where: { productId_modifierGroupId: { productId: parsed.data.productId, modifierGroupId: parsed.data.modifierGroupId } },
          create: { productId: parsed.data.productId, modifierGroupId: parsed.data.modifierGroupId, position: parsed.data.position },
          update: { position: parsed.data.position },
        });
      } else {
        await tx.productModifierGroup.deleteMany({ where: { productId: parsed.data.productId, modifierGroupId: parsed.data.modifierGroupId } });
      }
      await tx.adminAuditLog.create({
        data: {
          adminUserId: admin.id,
          action: "MODIFIER_UPDATED",
          targetType: parsed.data.operation,
          targetId: "id" in parsed.data ? parsed.data.id : `${parsed.data.productId}:${parsed.data.modifierGroupId}`,
          metadata: { operation: parsed.data.operation },
          requestId: id,
        },
      });
    });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 403 });
  }
}
