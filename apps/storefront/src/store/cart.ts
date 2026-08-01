"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SaleUnit } from "@mangal/contracts";

export const CART_SCHEMA_VERSION = 1;

export type CartLine = {
  productId: string;
  quantity: number;
  unit: SaleUnit;
  modifierOptionIds: string[];
};

type CartState = {
  schemaVersion: number;
  items: CartLine[];
  add: (line: CartLine) => void;
  setQuantity: (line: CartLine, quantity: number) => void;
  remove: (line: CartLine) => void;
  clear: () => void;
};

export function cartLineKey(line: CartLine): string {
  return `${line.productId}:${line.unit}:${line.quantity > 0 ? "unit" : "invalid"}:${[...line.modifierOptionIds].sort().join(",")}`;
}

function sameConfiguration(left: CartLine, right: CartLine): boolean {
  return left.productId === right.productId
    && left.unit === right.unit
    && [...left.modifierOptionIds].sort().join(",") === [...right.modifierOptionIds].sort().join(",");
}

export function mergeCartItems(items: CartLine[], line: CartLine): CartLine[] {
  const index = items.findIndex((item) => sameConfiguration(item, line));
  if (index < 0) return [...items, { ...line, modifierOptionIds: [...line.modifierOptionIds].sort() }];
  return items.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: item.quantity + line.quantity } : item);
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      schemaVersion: CART_SCHEMA_VERSION,
      items: [],
      add: (line) => set((state) => ({ items: mergeCartItems(state.items, line) })),
      setQuantity: (line, quantity) => set((state) => ({
        items: quantity <= 0
          ? state.items.filter((item) => !sameConfiguration(item, line))
          : state.items.map((item) => sameConfiguration(item, line) ? { ...item, quantity } : item),
      })),
      remove: (line) => set((state) => ({ items: state.items.filter((item) => !sameConfiguration(item, line)) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "mangal-cart",
      version: CART_SCHEMA_VERSION,
      partialize: (state) => ({ schemaVersion: state.schemaVersion, items: state.items }),
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== "object") return { schemaVersion: CART_SCHEMA_VERSION, items: [] };
        const candidate = persisted as { items?: unknown };
        const items = Array.isArray(candidate.items)
          ? candidate.items.filter(isSafeCartLine).map((line) => ({ ...line, modifierOptionIds: [...line.modifierOptionIds].sort() }))
          : [];
        return { schemaVersion: CART_SCHEMA_VERSION, items };
      },
    },
  ),
);

function isSafeCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<CartLine>;
  return typeof line.productId === "string"
    && Number.isSafeInteger(line.quantity) && (line.quantity ?? 0) > 0
    && ["PIECE", "PORTION", "KILOGRAM"].includes(line.unit ?? "")
    && Array.isArray(line.modifierOptionIds)
    && line.modifierOptionIds.every((id) => typeof id === "string");
}
