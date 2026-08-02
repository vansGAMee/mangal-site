import { z } from "zod";
import { validateAdminMutation } from "@/server/admin/auth";
import { slugify } from "@/server/catalog/menu-import";
import { readJsonBody, requestId } from "@/server/security/http";
import { db } from "@/server/shared/db";

const CreateProduct = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  compositionText: z.string().trim().max(1_000).nullable(),
  portionNote: z.string().trim().max(240).nullable(),
  pricingType: z.enum(["FIXED", "PER_KILOGRAM"]),
  saleUnit: z.enum(["PIECE", "PORTION", "KILOGRAM"]),
  priceKopecks: z.number().int().positive().nullable(),
  oldPriceKopecks: z.number().int().positive().nullable(),
  weightGrams: z.number().int().positive().nullable(),
  position: z.number().int().nonnegative(),
}).strict();

function priceLabel(price: number | null, pricingType: "FIXED" | "PER_KILOGRAM"): string {
  if (price === null) return "Цена уточняется";
  const rubles = Math.floor(price / 100);
  const kopecks = price % 100;
  return `${rubles}${kopecks ? `,${String(kopecks).padStart(2, "0")}` : ""} ₽${pricingType === "PER_KILOGRAM" ? " / кг" : ""}`;
}

export async function POST(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const admin = await validateAdminMutation(request);
    const parsed = CreateProduct.safeParse(await readJsonBody(request));
    if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
    const value = parsed.data;
    if (value.pricingType === "PER_KILOGRAM" && value.saleUnit !== "KILOGRAM") {
      return Response.json({ error: "kilogram_unit_required" }, { status: 409 });
    }
    if (value.pricingType === "FIXED" && value.saleUnit === "KILOGRAM") {
      return Response.json({ error: "fixed_unit_required" }, { status: 409 });
    }
    if (value.oldPriceKopecks !== null && (value.priceKopecks === null || value.oldPriceKopecks <= value.priceKopecks)) {
      return Response.json({ error: "old_price_must_exceed_current" }, { status: 409 });
    }
    if (!await db.category.findUnique({ where: { id: value.categoryId }, select: { id: true } })) {
      return Response.json({ error: "category_not_found" }, { status: 409 });
    }
    const slug = slugify(value.name);
    if (await db.product.findUnique({ where: { slug }, select: { id: true } })) {
      return Response.json({ error: "product_exists" }, { status: 409 });
    }
    const unpriced = value.priceKopecks === null;
    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          categoryId: value.categoryId,
          slug,
          name: value.name,
          compositionText: value.compositionText,
          portionNote: value.portionNote,
          pricingType: value.pricingType,
          saleUnit: value.saleUnit,
          basePriceKopecks: value.pricingType === "FIXED" ? value.priceKopecks : null,
          unitPriceKopecks: value.pricingType === "PER_KILOGRAM" ? value.priceKopecks : null,
          priceUnitGrams: value.pricingType === "PER_KILOGRAM" ? 1_000 : null,
          oldPriceKopecks: value.oldPriceKopecks,
          weightGrams: value.weightGrams,
          displayPriceLabel: priceLabel(value.priceKopecks, value.pricingType),
          requiresPriceConfirmation: unpriced,
          isOrderable: !unpriced,
          isAvailable: true,
          position: value.position,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          adminUserId: admin.id,
          action: "PRODUCT_CREATED",
          targetType: "Product",
          targetId: created.id,
          metadata: { categoryId: value.categoryId, pricingType: value.pricingType, saleUnit: value.saleUnit, unpriced },
          requestId: id,
        },
      });
      return created;
    });
    return Response.json(product, { status: 201 });
  } catch {
    return new Response(null, { status: 403 });
  }
}
