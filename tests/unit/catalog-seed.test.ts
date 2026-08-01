import { describe, expect, it } from "vitest";
import { ADDON_PRODUCT_SLUGS, CATEGORY_SEED, GARNISH_PRODUCT_SLUGS, MODIFIER_GROUP_SEED, PRODUCT_SEED } from "@mangal/catalog-seed";

describe("actual menu seed", () => {
  it("contains exactly the 33 supplied products in five categories", () => {
    expect(PRODUCT_SEED).toHaveLength(33);
    expect(CATEGORY_SEED).toHaveLength(5);
    expect(Object.fromEntries(CATEGORY_SEED.map((category) => [category.slug, PRODUCT_SEED.filter((product) => product.categorySlug === category.slug).length]))).toEqual({
      "shaurma-i-khot-dogi": 8,
      "burgery-i-donery": 8,
      "shashlyk-i-blyuda-na-tarelke": 11,
      prochee: 2,
      sousy: 4,
    });
  });

  it("does not invent prices for lavash shashlik and lyulya", () => {
    const unpriced = PRODUCT_SEED.filter((product) => product.requiresPriceConfirmation);
    expect(unpriced.map((product) => product.slug)).toEqual(["shashlyk-v-lavashe", "lyulya-v-lavashe"]);
    expect(unpriced.every((product) => product.basePriceKopecks === undefined && product.unitPriceKopecks === undefined && product.isOrderable === false)).toBe(true);
  });

  it("keeps meat grams in composition and only assigns product weight to fries", () => {
    expect(PRODUCT_SEED.filter((product) => product.weightGrams !== undefined)).toEqual([expect.objectContaining({ slug: "kartofel-fri", weightGrams: 100 })]);
  });

  it("binds modifiers explicitly", () => {
    expect(GARNISH_PRODUCT_SLUGS).toHaveLength(14);
    expect(ADDON_PRODUCT_SLUGS).toHaveLength(17);
    expect(GARNISH_PRODUCT_SLUGS.some((slug) => slug.startsWith("gamburger"))).toBe(false);
    const addons = MODIFIER_GROUP_SEED.find((group) => group.key === "addons");
    expect(addons?.options.map((option) => option.name)).toContain("Халапеньо");
    expect(addons?.options.filter((option) => option.priceDeltaKopecks === 0)).toHaveLength(3);
  });
});
