import { PublicCatalogResponseSchema, type PublicCatalogResponse } from "@mangal/contracts";

function platformApiUrl(): string {
  const value = process.env.PLATFORM_API_URL ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "http://localhost:3001";
  return value.replace(/\/$/, "");
}

export async function fetchCatalog(): Promise<PublicCatalogResponse> {
  try {
    const response = await fetch(`${platformApiUrl()}/api/public/catalog`, {
      next: { revalidate: 60, tags: ["catalog", "restaurant-profile"] },
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Catalog API returned ${response.status}`);
    }

    return PublicCatalogResponseSchema.parse(await response.json());
  } catch (error) {
    if (typeof window === "undefined" && !process.env.PLATFORM_API_URL) {
      return {
        categories: [],
        store: {
          profile: {
            slug: "mangal",
            name: "Заведение",
            description: "Онлайн-меню",
            logoPath: null,
            faviconPath: null,
            heroImagePath: null,
            heroTitle: null,
            theme: "MANGAL_DARK",
            primaryColor: "#E05638",
            secondaryColor: "#1B1A18",
            backgroundColor: "#0D0D0E",
            foregroundColor: "#F4F1EA",
            buttonColor: null,
            phoneDisplay: null,
            phoneHref: null,
            email: null,
            address: null,
            latitude: null,
            longitude: null,
            vkUrl: null,
            telegramUrl: null,
            whatsappUrl: null,
            currency: "RUB",
            timezone: "Europe/Moscow",
            seoTitle: "Онлайн-меню",
            seoDescription: "Заказ еды",
            legalName: null,
            legalInn: null,
            legalRegistrationNo: null,
            legalAddress: null,
            privacyPolicyPath: "/legal/privacy",
            deliveryEnabled: true,
            pickupEnabled: true,
            pickupLabel: "Самовывоз",
          },
          phoneDisplay: null,
          phoneHref: null,
          leadTimeMinutes: 15,
          personalDataLegalBasis: "CONTRACT",
          deliveryEnabled: true,
          pickupEnabled: true,
          pickupLabel: "Самовывоз",
          deliveryZones: [],
        },
      };
    }
    throw error;
  }
}
