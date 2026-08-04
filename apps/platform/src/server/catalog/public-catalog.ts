import type { PublicCatalogResponse } from "@mangal/contracts";
import { db } from "../shared/db";

export async function getPublicCatalog(): Promise<PublicCatalogResponse> {
  const [categories, store, profile, deliveryZones] = await Promise.all([
    db.category.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      include: {
        products: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: {
            imageAsset: true,
            modifierGroups: {
              where: { modifierGroup: { isActive: true } },
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
    db.restaurantProfile.findUniqueOrThrow({
      where: { id: "singleton" },
      include: { logoAsset: true, faviconAsset: true, heroImageAsset: true },
    }),
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
        oldPriceKopecks: product.oldPriceKopecks,
        unitPriceKopecks: product.unitPriceKopecks,
        priceUnitGrams: product.priceUnitGrams,
        weightGrams: product.weightGrams,
        displayPriceLabel: product.displayPriceLabel,
        requiresPriceConfirmation: product.requiresPriceConfirmation,
        isOrderable: product.isOrderable,
        isAvailable: product.isAvailable,
        imagePath: normalizeMediaUrl(product.imageAsset?.publicUrl ?? product.imagePath) ?? "/images/product-placeholder.svg",
        position: product.position,
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
      profile: {
        slug: profile.slug,
        name: profile.name,
        description: profile.description,
        logoPath: normalizeMediaUrl(profile.logoAsset?.publicUrl ?? profile.logoPath),
        faviconPath: normalizeMediaUrl(profile.faviconAsset?.publicUrl ?? profile.faviconPath),
        heroImagePath: normalizeMediaUrl(profile.heroImageAsset?.publicUrl ?? profile.heroImagePath),
        heroTitle: profile.heroTitle,
        theme: profile.theme,
        primaryColor: profile.primaryColor,
        secondaryColor: profile.secondaryColor,
        backgroundColor: profile.backgroundColor,
        foregroundColor: profile.foregroundColor,
        buttonColor: profile.buttonColor,
        phoneDisplay: profile.phoneDisplay,
        phoneHref: profile.phoneHref,
        email: profile.email,
        address: profile.address,
        latitude: profile.latitude,
        longitude: profile.longitude,
        vkUrl: profile.vkUrl,
        telegramUrl: profile.telegramUrl,
        whatsappUrl: profile.whatsappUrl,
        currency: profile.currency,
        timezone: profile.timezone,
        seoTitle: profile.seoTitle,
        seoDescription: profile.seoDescription,
        legalName: profile.legalName,
        legalInn: profile.legalInn,
        legalRegistrationNo: profile.legalRegistrationNo,
        legalAddress: profile.legalAddress,
        privacyPolicyPath: profile.privacyPolicyPath,
        deliveryEnabled: profile.deliveryEnabled,
        pickupEnabled: profile.pickupEnabled,
        pickupLabel: profile.pickupLabel,
      },
      phoneDisplay: profile.phoneDisplay,
      phoneHref: profile.phoneHref,
      leadTimeMinutes: store.leadTimeMinutes,
      personalDataLegalBasis: store.legalBasis,
      deliveryEnabled: profile.deliveryEnabled,
      pickupEnabled: profile.pickupEnabled,
      pickupLabel: profile.pickupLabel,
      deliveryZones: profile.deliveryEnabled ? deliveryZones : [],
    },
  };
}

function normalizeMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith("/uploads/")) return parsed.pathname;
      if (parsed.pathname.startsWith("/media/")) return `/uploads${parsed.pathname.slice(6)}`;
    } catch {
      // fallback
    }
  }
  if (url.startsWith("/media/")) return `/uploads${url.slice(6)}`;
  return url;
}
