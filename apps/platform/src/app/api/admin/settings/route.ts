import { RestaurantProfileInputSchema } from "@mangal/contracts";
import { z } from "zod";
import { authenticateAdminRequest, requireRole, validateAdminMutation } from "@/server/admin/auth";
import { readJsonBody, requestId } from "@/server/security/http";
import { db } from "@/server/shared/db";

const SettingsMutationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("profile"),
    version: z.number().int().positive(),
    profile: RestaurantProfileInputSchema,
  }),
  z.object({
    operation: z.literal("store"),
    version: z.number().int().positive(),
    leadTimeMinutes: z.number().int().positive().max(240),
    minimumOrderKopecks: z.number().int().nonnegative().nullable(),
    legalBasis: z.enum(["CONTRACT", "CONSENT"]),
    taxSystemCode: z.string().trim().min(1).max(40).nullable(),
  }),
  z.object({
    operation: z.literal("zone"),
    id: z.string().uuid().optional(),
    version: z.number().int().positive().optional(),
    name: z.string().trim().min(1).max(120),
    city: z.string().trim().min(1).max(120),
    feeKopecks: z.number().int().nonnegative(),
    freeThresholdKopecks: z.number().int().nonnegative().nullable(),
    minOrderKopecks: z.number().int().nonnegative().nullable(),
    isActive: z.boolean(),
  }),
  z.object({
    operation: z.literal("hours"),
    weekday: z.number().int().min(0).max(6),
    opensAt: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    closesAt: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    isClosed: z.boolean(),
    slotLength: z.number().int().positive().max(240),
    capacity: z.number().int().positive().nullable(),
  }),
]);

export async function GET(request: Request): Promise<Response> {
  try {
    await authenticateAdminRequest(request);
    const [profile, store, zones, hours, routing] = await Promise.all([
      db.restaurantProfile.findUnique({ where: { id: "singleton" } }),
      db.storeSettings.findUnique({ where: { id: "singleton" } }),
      db.deliveryZone.findMany({ orderBy: { name: "asc" } }),
      db.operatingHours.findMany({ orderBy: { weekday: "asc" } }),
      db.paymentRouting.findMany(),
    ]);
    return Response.json({ profile, store, zones, hours, routing }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 401 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const admin = await validateAdminMutation(request);
    requireRole(admin, ["ADMIN"]);
    const parsed = SettingsMutationSchema.safeParse(await readJsonBody(request));
    if (!parsed.success || !validHours(parsed.data)) {
      return Response.json({ error: "validation" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      let changed: unknown;
      if (parsed.data.operation === "profile") {
        const updated = await tx.restaurantProfile.updateMany({
          where: { id: "singleton", version: parsed.data.version },
          data: { ...parsed.data.profile, version: { increment: 1 } },
        });
        if (!updated.count) return null;
        changed = await tx.restaurantProfile.findUnique({ where: { id: "singleton" } });
      } else if (parsed.data.operation === "store") {
        const updated = await tx.storeSettings.updateMany({
          where: { id: "singleton", version: parsed.data.version },
          data: {
            leadTimeMinutes: parsed.data.leadTimeMinutes,
            minimumOrderKopecks: parsed.data.minimumOrderKopecks,
            legalBasis: parsed.data.legalBasis,
            taxSystemCode: parsed.data.taxSystemCode,
            version: { increment: 1 },
          },
        });
        if (!updated.count) return null;
        changed = await tx.storeSettings.findUnique({ where: { id: "singleton" } });
      } else if (parsed.data.operation === "zone") {
        const data = {
          name: parsed.data.name,
          city: parsed.data.city,
          feeKopecks: parsed.data.feeKopecks,
          freeThresholdKopecks: parsed.data.freeThresholdKopecks,
          minOrderKopecks: parsed.data.minOrderKopecks,
          isActive: parsed.data.isActive,
        };
        if (parsed.data.id) {
          if (!parsed.data.version) return null;
          const updated = await tx.deliveryZone.updateMany({
            where: { id: parsed.data.id, version: parsed.data.version },
            data: { ...data, version: { increment: 1 } },
          });
          if (!updated.count) return null;
          changed = await tx.deliveryZone.findUnique({ where: { id: parsed.data.id } });
        } else {
          changed = await tx.deliveryZone.create({ data });
        }
      } else {
        changed = await tx.operatingHours.upsert({
          where: { weekday: parsed.data.weekday },
          create: {
            weekday: parsed.data.weekday,
            opensAt: parsed.data.opensAt,
            closesAt: parsed.data.closesAt,
            isClosed: parsed.data.isClosed,
            slotLength: parsed.data.slotLength,
            capacity: parsed.data.capacity,
          },
          update: {
            opensAt: parsed.data.opensAt,
            closesAt: parsed.data.closesAt,
            isClosed: parsed.data.isClosed,
            slotLength: parsed.data.slotLength,
            capacity: parsed.data.capacity,
          },
        });
      }
      await tx.adminAuditLog.create({
        data: {
          adminUserId: admin.id,
          action: "STORE_SETTINGS_UPDATED",
          targetType: parsed.data.operation,
          targetId:
            "id" in parsed.data && parsed.data.id
              ? parsed.data.id
              : "weekday" in parsed.data
                ? String(parsed.data.weekday)
                : "singleton",
          metadata: {
            operation: parsed.data.operation,
            changedFields: parsed.data.operation === "profile"
              ? Object.keys(parsed.data.profile)
              : Object.keys(parsed.data).filter((key) => !["operation", "version", "id"].includes(key)),
          },
          requestId: id,
        },
      });
      return changed;
    });
    return result
      ? Response.json(result)
      : Response.json({ error: "version_conflict" }, { status: 409 });
  } catch {
    return new Response(null, { status: 403 });
  }
}

function validHours(value: z.infer<typeof SettingsMutationSchema>): boolean {
  if (value.operation !== "hours" || value.isClosed) return true;
  if (!value.opensAt || !value.closesAt) return false;
  const toMinutes = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour! * 60 + minute!;
  };
  return toMinutes(value.opensAt) < toMinutes(value.closesAt);
}
