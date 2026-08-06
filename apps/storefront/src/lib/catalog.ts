import type { PublicCatalogResponse } from "@mangal/contracts";

const FALLBACK_CATALOG: PublicCatalogResponse = {
  store: {
    phoneDisplay: "8 927 106 16 44",
    phoneHref: "+79271061644",
    leadTimeMinutes: 15,
    personalDataLegalBasis: "CONTRACT",
    deliveryZones: [
      {
        id: "zone-1",
        name: "Самовывоз / Заберу сам",
        city: "Маркс",
        feeKopecks: 0,
        freeThresholdKopecks: null,
        minOrderKopecks: null,
      },
    ],
  },
  categories: [
    {
      id: "cat-1",
      slug: "shashlyk-i-blyuda-na-tarelke",
      name: "Шашлык и блюда на тарелке",
      products: [
        {
          id: "prod-1",
          slug: "shashlyk-iz-svininy",
          name: "Шашлык из свинины",
          compositionText: "Свиная шейка, лук маринованный, специи, зелень",
          portionNote: "Цена за кг",
          pricingType: "PER_KILOGRAM",
          saleUnit: "KILOGRAM",
          basePriceKopecks: null,
          unitPriceKopecks: 130000,
          priceUnitGrams: 1000,
          weightGrams: 1000,
          displayPriceLabel: "1300 ₽ / кг",
          requiresPriceConfirmation: false,
          isOrderable: true,
          isAvailable: true,
          imagePath: "/images/demo/shashlyk.jpg",
          modifiers: [],
        },
        {
          id: "prod-2",
          slug: "shashlyk-iz-govyadiny",
          name: "Шашлык из говядины",
          compositionText: "Говяжья вырезка, специи, лук маринованный",
          portionNote: "Цена за кг",
          pricingType: "PER_KILOGRAM",
          saleUnit: "KILOGRAM",
          basePriceKopecks: null,
          unitPriceKopecks: 160000,
          priceUnitGrams: 1000,
          weightGrams: 1000,
          displayPriceLabel: "1600 ₽ / кг",
          requiresPriceConfirmation: false,
          isOrderable: true,
          isAvailable: true,
          imagePath: "",
          modifiers: [],
        },
        {
          id: "prod-3",
          slug: "shashlyk-iz-kuritsy",
          name: "Шашлык из курицы",
          compositionText: "Куриное филе, авторский маринад, специи",
          portionNote: "Цена за кг",
          pricingType: "PER_KILOGRAM",
          saleUnit: "KILOGRAM",
          basePriceKopecks: null,
          unitPriceKopecks: 100000,
          priceUnitGrams: 1000,
          weightGrams: 1000,
          displayPriceLabel: "1000 ₽ / кг",
          requiresPriceConfirmation: false,
          isOrderable: true,
          isAvailable: true,
          imagePath: "",
          modifiers: [],
        },
        {
          id: "prod-4",
          slug: "lyulya-kebab-iz-govyadiny",
          name: "Люля-кебаб из говядины",
          compositionText: "Сочный фарш из говядины, специи, зелень",
          portionNote: "Цена за кг",
          pricingType: "PER_KILOGRAM",
          saleUnit: "KILOGRAM",
          basePriceKopecks: null,
          unitPriceKopecks: 150000,
          priceUnitGrams: 1000,
          weightGrams: 1000,
          displayPriceLabel: "1500 ₽ / кг",
          requiresPriceConfirmation: false,
          isOrderable: true,
          isAvailable: true,
          imagePath: "",
          modifiers: [],
        },
      ],
    },
    {
      id: "cat-2",
      slug: "shaurma-i-khot-dogi",
      name: "Шаурма и хот-доги",
      products: [
        {
          id: "prod-5",
          slug: "shaurma-s-govyadinoy",
          name: "Шаурма с говядиной",
          compositionText: "Тонкий лаваш, мясо 100 г, огурец, помидор, фирменный соус",
          portionNote: null,
          pricingType: "FIXED",
          saleUnit: "PIECE",
          basePriceKopecks: 20000,
          unitPriceKopecks: null,
          priceUnitGrams: null,
          weightGrams: null,
          displayPriceLabel: "200 ₽",
          requiresPriceConfirmation: false,
          isOrderable: true,
          isAvailable: true,
          imagePath: "/images/demo/shaurma.jpg",
          modifiers: [],
        },
        {
          id: "prod-6",
          slug: "shaurma-so-svininoy",
          name: "Шаурма со свининой",
          compositionText: "Тонкий лаваш, мясо 100 г, сочные овощи, фирменный соус",
          portionNote: null,
          pricingType: "FIXED",
          saleUnit: "PIECE",
          basePriceKopecks: 19000,
          unitPriceKopecks: null,
          priceUnitGrams: null,
          weightGrams: null,
          displayPriceLabel: "190 ₽",
          requiresPriceConfirmation: false,
          isOrderable: true,
          isAvailable: true,
          imagePath: "",
          modifiers: [],
        },
      ],
    },
    {
      id: "cat-3",
      slug: "sousy",
      name: "Соусы",
      products: [
        {
          id: "prod-7",
          slug: "syrnyy-sous",
          name: "Сырный соус",
          compositionText: "Порция 50 г",
          portionNote: null,
          pricingType: "FIXED",
          saleUnit: "PORTION",
          basePriceKopecks: 5000,
          unitPriceKopecks: null,
          priceUnitGrams: null,
          weightGrams: null,
          displayPriceLabel: "50 ₽",
          requiresPriceConfirmation: false,
          isOrderable: true,
          isAvailable: true,
          imagePath: "/images/demo/sauce.jpg",
          modifiers: [],
        },
        {
          id: "prod-8",
          slug: "chesnochnyy-sous",
          name: "Чесночный соус",
          compositionText: "Порция 50 г",
          portionNote: null,
          pricingType: "FIXED",
          saleUnit: "PORTION",
          basePriceKopecks: 5000,
          unitPriceKopecks: null,
          priceUnitGrams: null,
          weightGrams: null,
          displayPriceLabel: "50 ₽",
          requiresPriceConfirmation: false,
          isOrderable: true,
          isAvailable: true,
          imagePath: "",
          modifiers: [],
        },
      ],
    },
  ],
};

const DEMO_IMAGE_MAP: Record<string, string> = {
  "shashlyk-iz-svininy": "/images/demo/shashlyk.jpg",
  "shashlyk-v-lavashe": "/images/demo/shashlyk.jpg",
  "lyulya-v-lavashe": "/images/demo/shashlyk.jpg",
  "shaurma-s-govyadinoy": "/images/demo/shaurma.jpg",
  "shaurma-s-kuritsey": "/images/demo/shaurma.jpg",
  "syrnyy-sous": "/images/demo/sauce.jpg",
  "hot-dog-so-slivochnoy-sosiskoy": "/images/demo/hotdog.jpg",
  "burger-klassicheskiy": "/images/demo/burger.jpg",
};

function enrichCatalog(catalog: PublicCatalogResponse): PublicCatalogResponse {
  return {
    ...catalog,
    categories: catalog.categories.map((category) => ({
      ...category,
      products: category.products.map((product) => {
        if (!product.imagePath || product.imagePath === "/images/product-placeholder.svg" || product.imagePath === "") {
          const fallback = DEMO_IMAGE_MAP[product.slug] 
            ?? (product.slug.includes("shaurma") || product.slug.includes("doner") ? "/images/demo/shaurma.jpg"
            : product.slug.includes("burger") ? "/images/demo/burger.jpg"
            : product.slug.includes("sous") ? "/images/demo/sauce.jpg"
            : product.slug.includes("hot-dog") ? "/images/demo/hotdog.jpg"
            : "/images/demo/shashlyk.jpg");
          return {
            ...product,
            imagePath: fallback,
          };
        }
        return product;
      }),
    })),
  };
}

export async function fetchCatalog(): Promise<PublicCatalogResponse> {
  const baseUrl = process.env.PLATFORM_API_URL ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL;
  if (baseUrl) {
    try {
      const response = await fetch(`${baseUrl}/api/public/catalog`, {
        next: { revalidate: 60, tags: ["catalog"] },
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        const raw = (await response.json()) as PublicCatalogResponse;
        return enrichCatalog(raw);
      }
    } catch {
      // Fallback if API fails
    }
  }
  return enrichCatalog(FALLBACK_CATALOG);
}
