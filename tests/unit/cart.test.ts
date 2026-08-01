// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { CART_SCHEMA_VERSION, mergeCartItems, useCart, type CartLine } from "../../apps/storefront/src/store/cart";

const base: CartLine = { productId: "p1", quantity: 1, unit: "PIECE", modifierOptionIds: ["b", "a"] };
describe("PII-free cart", () => {
  beforeEach(() => { localStorage.clear(); useCart.setState({ schemaVersion: CART_SCHEMA_VERSION, items: [] }); });
  it("merges equal sorted modifier sets", () => expect(mergeCartItems([base], { ...base, modifierOptionIds: ["a", "b"], quantity: 2 })).toEqual([{ ...base, quantity: 3 }]));
  it("does not merge different modifiers or units", () => {
    expect(mergeCartItems([base], { ...base, modifierOptionIds: ["a"] })).toHaveLength(2);
    expect(mergeCartItems([base], { ...base, unit: "PORTION" })).toHaveLength(2);
  });
  it("persists only safe cart fields", async () => {
    useCart.getState().add(base);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const stored = localStorage.getItem("mangal-cart") ?? "";
    expect(stored).toContain("productId"); expect(stored).not.toMatch(/phone|email|address|comment|checkout/i);
  });
});
