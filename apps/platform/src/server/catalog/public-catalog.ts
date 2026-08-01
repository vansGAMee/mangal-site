import type { PublicCatalogResponse } from "@mangal/contracts";
import { db } from "../shared/db";

export async function getPublicCatalog(): Promise<PublicCatalogResponse> {
  const [categories, store, deliveryZones] = await Promise.all([
    db.category.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      include: {
        products: {
          where: { isAvailable: true },
          orderBy: [{ createdAt: "asc" }],
          include: {
            modifierGroups: {
              orderBy: { position: "asc" },
              include: {
                modifierGroup: {
                  include: { options: { orderBy: { position: "asc" } } },
                },
              },
            },
          },
        },
      },
    }),
    db.storeSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
    db.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        city: true,
        feeKopecks: true,
        freeThresholdKopecks: true,
        minOrderKopecks: true,
      },
    }),
  ]);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      products: category.products.map((product) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        compositionText: product.compositionText,
        portionNote: product.portionNote,
        pricingType: product.pricingType,
        saleUnit: product.saleUnit,
        basePriceKopecks: product.basePriceKopecks,
        unitPriceKopecks: product.unitPriceKopecks,
        priceUnitGrams: product.priceUnitGrams,
        weightGrams: product.weightGrams,
        displayPriceLabel: product.displayPriceLabel,
        requiresPriceConfirmation: product.requiresPriceConfirmation,
        isOrderable: product.isOrderable,
        isAvailable: product.isAvailable,
        imagePath: product.imagePath,
        modifiers: product.modifierGroups.map(({ modifierGroup }) => ({
          id: modifierGroup.id,
          name: modifierGroup.name,
          kind: modifierGroup.kind,
          selectionMode: modifierGroup.selectionMode,
          required: modifierGroup.required,
          minSelect: modifierGroup.minSelect,
          maxSelect: modifierGroup.maxSelect,
          options: modifierGroup.options.map((option) => ({
            id: option.id,
            name: option.name,
            priceDeltaKopecks: option.priceDeltaKopecks,
            isAvailable: option.isAvailable,
          })),
        })),
      })),
    })),
    store: {
      phoneDisplay: "8 927 106 16 44",
      phoneHref: "+79271061644",
      leadTimeMinutes: store.leadTimeMinutes,
      personalDataLegalBasis: store.legalBasis,
      deliveryZones,
    },
  };
}
