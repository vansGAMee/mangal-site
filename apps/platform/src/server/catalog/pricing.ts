export type PriceableModifierOption = {
  id: string;
  name: string;
  priceDeltaKopecks: number;
  isAvailable: boolean;
};

export type PriceableModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
  options: PriceableModifierOption[];
};

export type PriceableProduct = {
  id: string;
  name: string;
  pricingType: "FIXED" | "PER_KILOGRAM";
  saleUnit: "PIECE" | "PORTION" | "KILOGRAM";
  basePriceKopecks: number | null;
  unitPriceKopecks: number | null;
  priceUnitGrams: number | null;
  requiresPriceConfirmation: boolean;
  isOrderable: boolean;
  isAvailable: boolean;
  modifierGroups: PriceableModifierGroup[];
};

export type PricingInput = {
  quantity: number;
  unit: "PIECE" | "PORTION" | "KILOGRAM";
  modifierOptionIds: string[];
};

export type PricedModifier = {
  id: string;
  groupName: string;
  optionName: string;
  priceDeltaKopecks: number;
};

export type PricedLine = {
  unitPriceKopecks: number;
  modifierTotalPerUnitKopecks: number;
  quantity: number;
  lineTotalKopecks: number;
  modifiers: PricedModifier[];
};

export type PricingErrorCode =
  | "invalid_quantity"
  | "unavailable_product"
  | "price_unconfirmed"
  | "unit_mismatch"
  | "modifier_unavailable"
  | "modifier_not_allowed"
  | "modifier_selection_invalid";

export class PricingError extends Error {
  constructor(readonly code: PricingErrorCode, message: string) {
    super(message);
  }
}

export function priceLine(product: PriceableProduct, input: PricingInput): PricedLine {
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new PricingError("invalid_quantity", "Количество должно быть положительным целым числом");
  }
  if (!product.isAvailable || !product.isOrderable) {
    throw new PricingError("unavailable_product", "Товар недоступен для заказа");
  }
  if (product.requiresPriceConfirmation) {
    throw new PricingError("price_unconfirmed", "Цена товара требует подтверждения");
  }
  if (product.saleUnit !== input.unit) {
    throw new PricingError("unit_mismatch", "Единица продажи изменилась");
  }
  if (product.pricingType === "PER_KILOGRAM" && input.unit !== "KILOGRAM") {
    throw new PricingError("unit_mismatch", "Весовой товар продаётся в килограммах");
  }

  const uniqueIds = new Set(input.modifierOptionIds);
  if (uniqueIds.size !== input.modifierOptionIds.length) {
    throw new PricingError("modifier_selection_invalid", "Модификатор нельзя выбрать дважды");
  }

  const allowedOptionIds = new Set(product.modifierGroups.flatMap((group) => group.options.map((option) => option.id)));
  for (const optionId of uniqueIds) {
    if (!allowedOptionIds.has(optionId)) throw new PricingError("modifier_not_allowed", "Модификатор не относится к товару");
  }

  const modifiers: PricedModifier[] = [];
  for (const group of product.modifierGroups) {
    const selected = group.options.filter((option) => uniqueIds.has(option.id));
    if (selected.length < group.minSelect || (group.maxSelect !== null && selected.length > group.maxSelect)) {
      throw new PricingError("modifier_selection_invalid", `Неверный выбор в группе «${group.name}»`);
    }
    if (group.required && selected.length === 0) {
      throw new PricingError("modifier_selection_invalid", `Выберите значение в группе «${group.name}»`);
    }
    for (const option of selected) {
      if (!option.isAvailable) throw new PricingError("modifier_unavailable", `Опция «${option.name}» недоступна`);
      modifiers.push({
        id: option.id,
        groupName: group.name,
        optionName: option.name,
        priceDeltaKopecks: option.priceDeltaKopecks,
      });
    }
  }

  const basePrice = product.pricingType === "FIXED" ? product.basePriceKopecks : product.unitPriceKopecks;
  if (basePrice === null || !Number.isSafeInteger(basePrice) || basePrice < 0) {
    throw new PricingError("price_unconfirmed", "У товара нет подтверждённой цены");
  }
  const modifierTotalPerUnitKopecks = modifiers.reduce((sum, item) => sum + item.priceDeltaKopecks, 0);
  const lineTotalKopecks = (basePrice + modifierTotalPerUnitKopecks) * input.quantity;
  if (!Number.isSafeInteger(lineTotalKopecks)) throw new PricingError("invalid_quantity", "Сумма заказа слишком велика");
  return {
    unitPriceKopecks: basePrice,
    modifierTotalPerUnitKopecks,
    quantity: input.quantity,
    lineTotalKopecks,
    modifiers,
  };
}
