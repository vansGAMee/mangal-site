import { describe, expect, it } from "vitest";
import { priceLine, PricingError, type PriceableProduct } from "../../apps/platform/src/server/catalog/pricing";

const product: PriceableProduct = {
  id: "p1", name: "Шаурма", pricingType: "FIXED", saleUnit: "PIECE", basePriceKopecks: 20_000, unitPriceKopecks: null, priceUnitGrams: null,
  requiresPriceConfirmation: false, isOrderable: true, isAvailable: true,
  modifierGroups: [
    { id: "garnish", name: "Гарнир", required: true, minSelect: 1, maxSelect: 1, options: [{ id: "fries", name: "Картофель фри", priceDeltaKopecks: 0, isAvailable: true }, { id: "carrot", name: "Морковь", priceDeltaKopecks: 0, isAvailable: true }] },
    { id: "addons", name: "Добавки", required: false, minSelect: 0, maxSelect: null, options: [{ id: "cheese", name: "Сыр", priceDeltaKopecks: 2_000, isAvailable: true }, { id: "jalapeno", name: "Халапеньо", priceDeltaKopecks: 0, isAvailable: true }] },
  ],
};

describe("server pricing", () => {
  it("calculates price from catalog and selected modifiers", () => expect(priceLine(product, { quantity: 2, unit: "PIECE", modifierOptionIds: ["fries", "cheese"] }).lineTotalKopecks).toBe(44_000));
  it("rejects a missing required garnish", () => expectCode(() => priceLine(product, { quantity: 1, unit: "PIECE", modifierOptionIds: [] }), "modifier_selection_invalid"));
  it("rejects multiple values in a single group", () => expectCode(() => priceLine(product, { quantity: 1, unit: "PIECE", modifierOptionIds: ["fries", "carrot"] }), "modifier_selection_invalid"));
  it("rejects unavailable product and modifier", () => {
    expectCode(() => priceLine({ ...product, isAvailable: false }, { quantity: 1, unit: "PIECE", modifierOptionIds: ["fries"] }), "unavailable_product");
    const changed = structuredClone(product); changed.modifierGroups[0]!.options[0]!.isAvailable = false;
    expectCode(() => priceLine(changed, { quantity: 1, unit: "PIECE", modifierOptionIds: ["fries"] }), "modifier_unavailable");
  });
  it("rejects injected and duplicated modifiers", () => {
    expectCode(() => priceLine(product, { quantity: 1, unit: "PIECE", modifierOptionIds: ["foreign"] }), "modifier_not_allowed");
    expectCode(() => priceLine(product, { quantity: 1, unit: "PIECE", modifierOptionIds: ["fries", "fries"] }), "modifier_selection_invalid");
  });
  it("prices integer kilograms without floating-point rounding", () => {
    const kilogram: PriceableProduct = { ...product, pricingType: "PER_KILOGRAM", saleUnit: "KILOGRAM", basePriceKopecks: null, unitPriceKopecks: 160_000, priceUnitGrams: 1000, modifierGroups: [] };
    expect(priceLine(kilogram, { quantity: 3, unit: "KILOGRAM", modifierOptionIds: [] }).lineTotalKopecks).toBe(480_000);
    expectCode(() => priceLine(kilogram, { quantity: 1, unit: "PIECE", modifierOptionIds: [] }), "unit_mismatch");
    expectCode(() => priceLine(kilogram, { quantity: 1.5, unit: "KILOGRAM", modifierOptionIds: [] }), "invalid_quantity");
  });
  it("never treats a missing price as zero", () => expectCode(() => priceLine({ ...product, basePriceKopecks: null, requiresPriceConfirmation: true, isOrderable: true }, { quantity: 1, unit: "PIECE", modifierOptionIds: ["fries"] }), "price_unconfirmed"));
});

function expectCode(action: () => unknown, code: string) { try { action(); throw new Error("expected pricing error"); } catch (error) { expect(error).toBeInstanceOf(PricingError); expect((error as PricingError).code).toBe(code); } }
