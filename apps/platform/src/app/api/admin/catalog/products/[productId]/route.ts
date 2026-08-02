import { z } from "zod";
import { validateAdminMutation } from "@/server/admin/auth";
import { readJsonBody, requestId } from "@/server/security/http";
import { db } from "@/server/shared/db";

const optionalPrice = z.number().int().positive().nullable().optional();
const Schema = z.object({
  version: z.number().int().positive(),
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160).optional(),
  compositionText: z.string().trim().max(1_000).nullable().optional(),
  portionNote: z.string().trim().max(240).nullable().optional(),
  basePriceKopecks: optionalPrice,
  oldPriceKopecks: optionalPrice,
  unitPriceKopecks: optionalPrice,
  displayPriceLabel: z.string().trim().min(1).max(80).optional(),
  requiresPriceConfirmation: z.boolean().optional(),
  isOrderable: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
  fiscalVatCode: z.string().trim().min(1).max(40).nullable().optional(),
  fiscalPaymentSubject: z.string().trim().min(1).max(80).nullable().optional(),
  fiscalPaymentMode: z.string().trim().min(1).max(80).nullable().optional(),
  fiscalMeasure: z.string().trim().min(1).max(80).nullable().optional(),
}).strict();

export async function PATCH(request: Request, context: { params: Promise<{ productId: string }> }): Promise<Response> {
  const id = requestId(request);
  try {
    const admin = await validateAdminMutation(request);
    const parsed = Schema.safeParse(await readJsonBody(request));
    if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
    const { productId } = await context.params;
    const current = await db.product.findUnique({ where: { id: productId } });
    if (!current) return new Response(null, { status: 404 });
    if (current.version !== parsed.data.version) return Response.json({ error: "version_conflict" }, { status: 409 });
    if (parsed.data.categoryId && !await db.category.findUnique({ where: { id: parsed.data.categoryId }, select: { id: true } })) {
      return Response.json({ error: "category_not_found" }, { status: 409 });
    }
    const nextRequiresPriceConfirmation = parsed.data.requiresPriceConfirmation ?? current.requiresPriceConfirmation;
    const nextIsOrderable = parsed.data.isOrderable ?? current.isOrderable;
    const nextBasePrice = parsed.data.basePriceKopecks !== undefined ? parsed.data.basePriceKopecks : current.basePriceKopecks;
    const nextUnitPrice = parsed.data.unitPriceKopecks !== undefined ? parsed.data.unitPriceKopecks : current.unitPriceKopecks;
    const nextOldPrice = parsed.data.oldPriceKopecks !== undefined ? parsed.data.oldPriceKopecks : current.oldPriceKopecks;
    if (nextRequiresPriceConfirmation && (nextIsOrderable || nextBasePrice !== null || nextUnitPrice !== null || nextOldPrice !== null)) {
      return Response.json({ error: "unconfirmed_price_must_be_blocked" }, { status: 409 });
    }
    if (current.pricingType === "FIXED" && !nextRequiresPriceConfirmation && nextBasePrice === null) {
      return Response.json({ error: "fixed_price_required" }, { status: 409 });
    }
    if (current.pricingType === "PER_KILOGRAM" && nextUnitPrice === null) {
      return Response.json({ error: "kilogram_price_required" }, { status: 409 });
    }
    const currentPrice = current.pricingType === "FIXED" ? nextBasePrice : nextUnitPrice;
    if (nextOldPrice !== null && (currentPrice === null || nextOldPrice <= currentPrice)) {
      return Response.json({ error: "old_price_must_exceed_current" }, { status: 409 });
    }
    const changes = {
      ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.compositionText !== undefined ? { compositionText: parsed.data.compositionText } : {}),
      ...(parsed.data.portionNote !== undefined ? { portionNote: parsed.data.portionNote } : {}),
      ...(parsed.data.basePriceKopecks !== undefined ? { basePriceKopecks: parsed.data.basePriceKopecks } : {}),
      ...(parsed.data.oldPriceKopecks !== undefined ? { oldPriceKopecks: parsed.data.oldPriceKopecks } : {}),
      ...(parsed.data.unitPriceKopecks !== undefined ? { unitPriceKopecks: parsed.data.unitPriceKopecks } : {}),
      ...(parsed.data.displayPriceLabel !== undefined ? { displayPriceLabel: parsed.data.displayPriceLabel } : {}),
      ...(parsed.data.requiresPriceConfirmation !== undefined ? { requiresPriceConfirmation: parsed.data.requiresPriceConfirmation } : {}),
      ...(parsed.data.isOrderable !== undefined ? { isOrderable: parsed.data.isOrderable } : {}),
      ...(parsed.data.isAvailable !== undefined ? { isAvailable: parsed.data.isAvailable } : {}),
      ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
      ...(parsed.data.fiscalVatCode !== undefined ? { fiscalVatCode: parsed.data.fiscalVatCode } : {}),
      ...(parsed.data.fiscalPaymentSubject !== undefined ? { fiscalPaymentSubject: parsed.data.fiscalPaymentSubject } : {}),
      ...(parsed.data.fiscalPaymentMode !== undefined ? { fiscalPaymentMode: parsed.data.fiscalPaymentMode } : {}),
      ...(parsed.data.fiscalMeasure !== undefined ? { fiscalMeasure: parsed.data.fiscalMeasure } : {}),
    };
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.product.updateMany({
        where: { id: productId, version: parsed.data.version },
        data: { ...changes, version: { increment: 1 } },
      });
      if (!result.count) return null;
      await tx.adminAuditLog.create({
        data: {
          adminUserId: admin.id,
          action: "PRODUCT_UPDATED",
          targetType: "Product",
          targetId: productId,
          metadata: { changedFields: Object.keys(changes) },
          requestId: id,
        },
      });
      return tx.product.findUnique({ where: { id: productId } });
    });
    return updated ? Response.json(updated) : Response.json({ error: "version_conflict" }, { status: 409 });
  } catch {
    return new Response(null, { status: 403 });
  }
}
