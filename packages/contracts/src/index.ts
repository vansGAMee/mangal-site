import { z } from "zod";

export const PricingTypeSchema = z.enum(["FIXED", "PER_KILOGRAM"]);
export const SaleUnitSchema = z.enum(["PIECE", "PORTION", "KILOGRAM"]);
export const PaymentMethodSchema = z.enum(["CARD", "SBP"]);
export const PaymentProviderSchema = z.enum(["YOOKASSA", "TBANK"]);

export const FixedCheckoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  modifierOptionIds: z.array(z.string().uuid()),
  unit: z.enum(["PIECE", "PORTION"]),
});

export const KilogramCheckoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  modifierOptionIds: z.array(z.string().uuid()),
  unit: z.literal("KILOGRAM"),
});

export const CheckoutItemSchema = z.union([
  FixedCheckoutItemSchema,
  KilogramCheckoutItemSchema,
]);

export const CheckoutRequestSchema = z.object({
  checkoutId: z.string().uuid(),
  items: z.array(CheckoutItemSchema).min(1),
  contact: z.object({
    phone: z.string().regex(/^\+7\d{10}$/),
    email: z.string().email().optional(),
  }),
  delivery: z.object({
    zoneId: z.string().uuid(),
    city: z.string().trim().min(1).max(120),
    street: z.string().trim().min(1).max(180),
    house: z.string().trim().min(1).max(40),
    apartment: z.string().trim().max(40).optional(),
    entrance: z.string().trim().max(40).optional(),
    floor: z.string().trim().max(40).optional(),
    intercom: z.string().trim().max(80).optional(),
    slotStart: z.string().datetime({ offset: true }),
    comment: z.string().trim().max(500).optional(),
  }),
  paymentMethod: PaymentMethodSchema,
  consents: z.object({
    personalData: z
      .object({ accepted: z.boolean(), version: z.literal("pd-v1") })
      .optional(),
    marketing: z.object({
      accepted: z.boolean(),
      version: z.literal("marketing-v1"),
    }),
    offer: z.object({ accepted: z.literal(true), version: z.literal("offer-v1") }),
    terms: z.object({ accepted: z.literal(true), version: z.literal("terms-v1") }),
  }),
});

export const EncryptedValueSchema = z.object({
  version: z.number().int().positive(),
  keyId: z.string().min(1),
  algorithm: z.literal("AES-256-GCM"),
  nonce: z.string().min(1),
  ciphertext: z.string(),
  authTag: z.string().min(1),
});

export type PricingType = z.infer<typeof PricingTypeSchema>;
export type SaleUnit = z.infer<typeof SaleUnitSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;
export type CheckoutItem = z.infer<typeof CheckoutItemSchema>;
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;
export type EncryptedValue = z.infer<typeof EncryptedValueSchema>;

export type CatalogModifierOption = {
  id: string;
  name: string;
  priceDeltaKopecks: number;
  isAvailable: boolean;
};

export type CatalogModifierGroup = {
  id: string;
  name: string;
  kind: "OTHER";
  selectionMode: "SINGLE" | "MULTIPLE";
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
  options: CatalogModifierOption[];
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  compositionText: string | null;
  portionNote: string | null;
  pricingType: PricingType;
  saleUnit: SaleUnit;
  basePriceKopecks: number | null;
  unitPriceKopecks: number | null;
  priceUnitGrams: number | null;
  weightGrams: number | null;
  displayPriceLabel: string;
  requiresPriceConfirmation: boolean;
  isOrderable: boolean;
  isAvailable: boolean;
  imagePath: string;
  modifiers: CatalogModifierGroup[];
};

export type CatalogCategory = {
  id: string;
  slug: string;
  name: string;
  products: CatalogProduct[];
};

export type PublicCatalogResponse = {
  categories: CatalogCategory[];
  store: {
    phoneDisplay: "8 927 106 16 44";
    phoneHref: "+79271061644";
    leadTimeMinutes: number;
    personalDataLegalBasis: "CONTRACT" | "CONSENT";
    deliveryZones: Array<{
      id: string;
      name: string;
      city: string;
      feeKopecks: number;
      freeThresholdKopecks: number | null;
      minOrderKopecks: number | null;
    }>;
  };
};

export type ApiErrorCode =
  | "validation"
  | "catalog_changed"
  | "slot_unavailable"
  | "checkout_conflict"
  | "consent_required"
  | "min_order"
  | "rate_limited"
  | "payment_provider_unavailable"
  | "store_not_configured"
  | "unauthorized"
  | "forbidden"
  | "version_conflict";

export type ApiErrorResponse = {
  error: { code: ApiErrorCode; message: string; requestId: string };
};
