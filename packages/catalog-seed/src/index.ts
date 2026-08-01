export type SeedProduct = {
  categorySlug: string;
  slug: string;
  name: string;
  compositionText?: string;
  portionNote?: string;
  pricingType: "FIXED" | "PER_KILOGRAM";
  saleUnit: "PIECE" | "PORTION" | "KILOGRAM";
  basePriceKopecks?: number;
  unitPriceKopecks?: number;
  priceUnitGrams?: number;
  weightGrams?: number;
  displayPriceLabel: string;
  requiresPriceConfirmation?: boolean;
  isOrderable?: boolean;
};

export const STORE_SEED = {
  phoneDisplay: "8 927 106 16 44",
  phoneHref: "+79271061644",
  leadTimeMinutes: 15,
} as const;

export const CATEGORY_SEED = [
  { slug: "shaurma-i-khot-dogi", name: "Шаурма и хот-доги", sortOrder: 10 },
  { slug: "burgery-i-donery", name: "Бургеры и донеры", sortOrder: 20 },
  { slug: "shashlyk-i-blyuda-na-tarelke", name: "Шашлык и блюда на тарелке", sortOrder: 30 },
  { slug: "prochee", name: "Прочее", sortOrder: 40 },
  { slug: "sousy", name: "Соусы", sortOrder: 50 },
] as const;

const fixed = (
  categorySlug: string,
  slug: string,
  name: string,
  basePriceKopecks: number,
  compositionText?: string,
  saleUnit: "PIECE" | "PORTION" = "PIECE",
): SeedProduct => ({
  categorySlug,
  slug,
  name,
  ...(compositionText === undefined ? {} : { compositionText }),
  pricingType: "FIXED",
  saleUnit,
  basePriceKopecks,
  displayPriceLabel: `${basePriceKopecks / 100} ₽`,
});

const perKilogram = (
  slug: string,
  name: string,
  unitPriceKopecks: number,
): SeedProduct => ({
  categorySlug: "shashlyk-i-blyuda-na-tarelke",
  slug,
  name,
  pricingType: "PER_KILOGRAM",
  saleUnit: "KILOGRAM",
  unitPriceKopecks,
  priceUnitGrams: 1000,
  displayPriceLabel: `${unitPriceKopecks / 100} ₽ / кг`,
});

export const PRODUCT_SEED: SeedProduct[] = [
  fixed("shaurma-i-khot-dogi", "shaurma-s-govyadinoy", "Шаурма с говядиной", 20000, "тонкий лаваш, мясо 100 г, огурец, помидор, чесночно-сливочный соус"),
  fixed("shaurma-i-khot-dogi", "mini-shaurma-s-govyadinoy", "Мини-шаурма с говядиной", 15000, "тонкий лаваш, мясо 50 г, огурец, помидор, чесночно-сливочный соус"),
  fixed("shaurma-i-khot-dogi", "shaurma-so-svininoy", "Шаурма со свининой", 19000, "тонкий лаваш, мясо 100 г, огурец, помидор, чесночно-сливочный соус"),
  fixed("shaurma-i-khot-dogi", "mini-shaurma-so-svininoy", "Мини-шаурма со свининой", 14000, "тонкий лаваш, мясо 50 г, огурец, помидор, чесночно-сливочный соус"),
  fixed("shaurma-i-khot-dogi", "shaurma-s-kuritsey", "Шаурма с курицей", 18000, "тонкий лаваш, курица 100 г, огурец, помидор, чесночно-сливочный соус"),
  fixed("shaurma-i-khot-dogi", "mini-shaurma-s-kuritsey", "Мини-шаурма с курицей", 13000, "тонкий лаваш, курица 50 г, огурец, помидор, чесночно-сливочный соус"),
  fixed("shaurma-i-khot-dogi", "hot-dog-so-slivochnoy-sosiskoy", "Хот-дог со сливочной сосиской", 8000, "булка, сливочная сосиска, огурец, помидор, чесночно-сливочный соус"),
  fixed("shaurma-i-khot-dogi", "hot-dog-s-okhotnichey-kolbaskoy", "Хот-дог с охотничьей колбаской", 9000, "булка, охотничья колбаска, огурец, помидор, чесночно-сливочный соус"),

  fixed("burgery-i-donery", "gamburger-s-govyazhey-kotletoy", "Гамбургер с говяжьей котлетой", 16000, "булка, бургер-соус, говяжья котлета, сыр, помидор, лист салата"),
  fixed("burgery-i-donery", "gamburger-s-kurinoy-kotletoy", "Гамбургер с куриной котлетой", 15000, "булка, бургер-соус, куриная котлета, сыр, помидор, лист салата"),
  fixed("burgery-i-donery", "burger-s-govyadinoy", "Бургер с говядиной", 15000, "булка, мясо 50 г, огурец, помидор, чесночно-сливочный соус"),
  fixed("burgery-i-donery", "burger-so-svininoy", "Бургер со свининой", 14000, "булка, мясо 50 г, огурец, помидор, чесночно-сливочный соус"),
  fixed("burgery-i-donery", "burger-s-kuritsey", "Бургер с курицей", 13000, "булка, курица 50 г, огурец, помидор, чесночно-сливочный соус"),
  fixed("burgery-i-donery", "doner-s-govyadinoy", "Донер с говядиной", 21000, "толстый лаваш, мясо 100 г, огурец, помидор, чесночно-сливочный соус"),
  fixed("burgery-i-donery", "doner-so-svininoy", "Донер со свининой", 20000, "толстый лаваш, мясо 100 г, огурец, помидор, чесночно-сливочный соус"),
  fixed("burgery-i-donery", "doner-s-kuritsey", "Донер с курицей", 19000, "толстый лаваш, курица 100 г, огурец, помидор, чесночно-сливочный соус"),

  { categorySlug: "shashlyk-i-blyuda-na-tarelke", slug: "shashlyk-v-lavashe", name: "Шашлык в лаваше", pricingType: "FIXED", saleUnit: "PIECE", displayPriceLabel: "Цена уточняется", requiresPriceConfirmation: true, isOrderable: false },
  { categorySlug: "shashlyk-i-blyuda-na-tarelke", slug: "lyulya-v-lavashe", name: "Люля в лаваше", pricingType: "FIXED", saleUnit: "PIECE", displayPriceLabel: "Цена уточняется", requiresPriceConfirmation: true, isOrderable: false },
  perKilogram("shashlyk-iz-govyadiny", "Шашлык из говядины", 160000),
  perKilogram("shashlyk-iz-baraniny", "Шашлык из баранины", 160000),
  perKilogram("shashlyk-iz-svininy", "Шашлык из свинины", 130000),
  perKilogram("shashlyk-iz-kuritsy", "Шашлык из курицы", 100000),
  perKilogram("lyulya-kebab-iz-govyadiny", "Люля-кебаб из говядины", 150000),
  perKilogram("lyulya-kebab-iz-kuritsy", "Люля-кебаб из курицы", 120000),
  fixed("shashlyk-i-blyuda-na-tarelke", "shaurma-na-tarelke-s-govyadinoy", "Шаурма на тарелке с говядиной", 22000, undefined, "PORTION"),
  fixed("shashlyk-i-blyuda-na-tarelke", "shaurma-na-tarelke-so-svininoy", "Шаурма на тарелке со свининой", 21000, undefined, "PORTION"),
  fixed("shashlyk-i-blyuda-na-tarelke", "shaurma-na-tarelke-s-kuritsey", "Шаурма на тарелке с курицей", 20000, undefined, "PORTION"),

  fixed("prochee", "burum", "Бурум", 15000, "лаваш, варёное яйцо, сыр-брынза, зелень, чесночно-сливочный соус"),
  { ...fixed("prochee", "kartofel-fri", "Картофель фри", 12000, undefined, "PORTION"), weightGrams: 100, portionNote: "Порция 100 г" },

  fixed("sousy", "syrnyy-sous", "Сырный соус", 5000, undefined, "PORTION"),
  fixed("sousy", "chesnochnyy-sous", "Чесночный соус", 5000, undefined, "PORTION"),
  fixed("sousy", "tomatnyy-sous", "Томатный соус", 5000, undefined, "PORTION"),
  fixed("sousy", "sous-barbekyu", "Соус барбекю", 5000, undefined, "PORTION"),
];

export const GARNISH_PRODUCT_SLUGS = [
  "shaurma-s-govyadinoy", "mini-shaurma-s-govyadinoy", "shaurma-so-svininoy",
  "mini-shaurma-so-svininoy", "shaurma-s-kuritsey", "mini-shaurma-s-kuritsey",
  "hot-dog-so-slivochnoy-sosiskoy", "hot-dog-s-okhotnichey-kolbaskoy",
  "burger-s-govyadinoy", "burger-so-svininoy", "burger-s-kuritsey",
  "doner-s-govyadinoy", "doner-so-svininoy", "doner-s-kuritsey",
] as const;

export const ADDON_PRODUCT_SLUGS = [
  "shaurma-s-govyadinoy", "mini-shaurma-s-govyadinoy", "shaurma-so-svininoy",
  "mini-shaurma-so-svininoy", "shaurma-s-kuritsey", "mini-shaurma-s-kuritsey",
  "burger-s-govyadinoy", "burger-so-svininoy", "burger-s-kuritsey",
  "doner-s-govyadinoy", "doner-so-svininoy", "doner-s-kuritsey",
  "shaurma-na-tarelke-s-govyadinoy", "shaurma-na-tarelke-so-svininoy",
  "shaurma-na-tarelke-s-kuritsey", "shashlyk-v-lavashe", "lyulya-v-lavashe",
] as const;

export const MODIFIER_GROUP_SEED = [
  {
    key: "garnish",
    name: "Гарнир",
    kind: "OTHER" as const,
    selectionMode: "SINGLE" as const,
    required: true,
    minSelect: 1,
    maxSelect: 1,
    options: [
      { key: "garnish-fries", name: "Картофель фри", priceDeltaKopecks: 0 },
      { key: "garnish-carrot", name: "Морковь", priceDeltaKopecks: 0 },
    ],
    productSlugs: GARNISH_PRODUCT_SLUGS,
  },
  {
    key: "addons",
    name: "Добавки",
    kind: "OTHER" as const,
    selectionMode: "MULTIPLE" as const,
    required: false,
    minSelect: 0,
    maxSelect: null,
    options: [
      { key: "addon-pickled-cucumber", name: "Маринованный огурец", priceDeltaKopecks: 2000 },
      { key: "addon-fries", name: "Картофель фри", priceDeltaKopecks: 4000 },
      { key: "addon-cheese", name: "Сыр", priceDeltaKopecks: 2000 },
      { key: "addon-onion", name: "Лук", priceDeltaKopecks: 0 },
      { key: "addon-greens", name: "Зелень", priceDeltaKopecks: 0 },
      { key: "addon-jalapeno", name: "Халапеньо", priceDeltaKopecks: 0 },
    ],
    productSlugs: ADDON_PRODUCT_SLUGS,
  },
] as const;

if (PRODUCT_SEED.length !== 33) {
  throw new Error(`Catalog seed must contain 33 products, received ${PRODUCT_SEED.length}`);
}

