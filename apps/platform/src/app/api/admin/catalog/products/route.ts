import { z } from "zod";
import { validateAdminMutation } from "@/server/admin/auth";
import { db } from "@/server/shared/db";
import { requestId } from "@/server/security/http";
import { NextResponse } from "next/server";

const CreateSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  displayPriceLabel: z.string().trim().min(1).max(80),
  priceKopecks: z.number().int().nonnegative(),
  compositionText: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const admin = await validateAdminMutation(request);
    const parsed = CreateSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });

    const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9а-я]+/gi, "-").replace(/^-+|-+$/g, "") || `item-${Date.now()}`;
    
    const count = await db.product.count({ where: { categoryId: parsed.data.categoryId } });

    const product = await db.product.create({
      data: {
        categoryId: parsed.data.categoryId,
        slug,
        name: parsed.data.name,
        displayPriceLabel: parsed.data.displayPriceLabel,
        basePriceKopecks: parsed.data.priceKopecks,
        compositionText: parsed.data.compositionText || null,
        pricingType: "FIXED",
        saleUnit: "PORTION",
        isAvailable: true,
        isOrderable: true,
        requiresPriceConfirmation: false,
        imagePath: "/images/product-placeholder.svg",
      },
    });

    await db.adminAuditLog.create({
      data: { adminUserId: admin.id, action: "PRODUCT_CREATED", targetType: "Product", targetId: product.id, requestId: id, metadata: {} },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "failed" }, { status: 500 });
  }
}
