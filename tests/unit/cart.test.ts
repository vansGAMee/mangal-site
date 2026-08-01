// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
const mockStore: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => mockStore[key] ?? null,
  setItem: (key: string, value: string) => { mockStore[key] = value; },
  removeItem: (key: string) => { delete mockStore[key]; },
  clear: () => { Object.keys(mockStore).forEach((k) => delete mockStore[k]); },
};
Object.defineProperty(globalThis, "localStorage", { value: mockStorage, writable: true, configurable: true });

const { CART_SCHEMA_VERSION, mergeCartItems, useCart } = await import("../../apps/storefront/src/store/cart");

const base: CartLine = { productId: "p1", quantity: 1, unit: "PIECE", modifierOptionIds: ["b", "a"] };

describe("PII-free cart", () => {
  beforeEach(() => {
    mockStorage.clear();
    useCart.setState({ schemaVersion: CART_SCHEMA_VERSION, items: [] });
  });
  it("merges equal sorted modifier sets", () => expect(mergeCartItems([base], { ...base, modifierOptionIds: ["a", "b"], quantity: 2 })).toEqual([{ ...base, quantity: 3 }]));
  it("does not merge different modifiers or units", () => {
    expect(mergeCartItems([base], { ...base, modifierOptionIds: ["a"] })).toHaveLength(2);
    expect(mergeCartItems([base], { ...base, unit: "PORTION" })).toHaveLength(2);
  });
  it("persists only safe cart fields", async () => {
    useCart.getState().add(base);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const stored = mockStorage.getItem("mangal-cart") ?? "";
    expect(stored).toContain("productId"); expect(stored).not.toMatch(/phone|email|address|comment|checkout/i);
  });
});
