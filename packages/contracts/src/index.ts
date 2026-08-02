import { z } from "zod";

export const PricingTypeSchema = z.enum(["FIXED", "PER_KILOGRAM"]);
export const SaleUnitSchema = z.enum(["PIECE", "PORTION", "KILOGRAM"]);
export const PaymentMethodSchema = z.enum(["CARD", "SBP"]);
export const PaymentProviderSchema = z.enum(["YOOKASSA", "TBANK"]);
export const RestaurantThemeSchema = z.enum(["MANGAL_DARK", "CAFE_LIGHT", "SUSHI_MINIMAL"]);
export const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

export function colorContrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

const OptionalUrlSchema = z.string().url().max(500).nullable();

export const RestaurantProfileInputSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable(),
  logoPath: z.string().trim().max(500).nullable(),
  faviconPath: z.string().trim().max(500).nullable(),
  heroImagePath: z.string().trim().max(500).nullable(),
  theme: RestaurantThemeSchema,
  primaryColor: HexColorSchema,
  secondaryColor: HexColorSchema,
  backgroundColor: HexColorSchema,
  foregroundColor: HexColorSchema,
  phoneDisplay: z.string().trim().max(40).nullable(),
  phoneHref: z.string().regex(/^\+\d{7,15}$/).nullable(),
  email: z.string().email().max(254).nullable(),
  address: z.string().trim().max(300).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  vkUrl: OptionalUrlSchema,
  telegramUrl: OptionalUrlSchema,
  whatsappUrl: OptionalUrlSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  timezone: z.string().trim().min(1).max(80),
  seoTitle: z.string().trim().min(1).max(120),
  seoDescription: z.string().trim().min(1).max(320),
  legalName: z.string().trim().max(200).nullable(),
  legalInn: z.string().regex(/^(?:\d{10}|\d{12})$/).nullable(),
  legalRegistrationNo: z.string().regex(/^(?:\d{13}|\d{15})$/).nullable(),
  legalAddress: z.string().trim().max(300).nullable(),
  privacyPolicyPath: z.string().trim().startsWith("/").max(200),
  deliveryEnabled: z.boolean(),
  pickupEnabled: z.boolean(),
  pickupLabel: z.string().trim().max(120).nullable(),
}).superRefine((profile, context) => {
  if (colorContrastRatio(profile.backgroundColor, profile.foregroundColor) < 4.5) {
    context.addIssue({
      code: "custom",
      path: ["foregroundColor"],
      message: "Контраст текста и фона должен быть не ниже 4.5:1",
    });
  }
  if (profile.pickupEnabled && !profile.pickupLabel) {
    context.addIssue({
      code: "custom",
      path: ["pickupLabel"],
      message: "Укажите подпись точки самовывоза",
    });
  }
});

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

export const DeliveryFulfillmentSchema = z.object({
  method: z.literal("DELIVERY"),
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
});

export const PickupFulfillmentSchema = z.object({
  method: z.literal("PICKUP"),
  slotStart: z.string().datetime({ offset: true }),
  comment: z.string().trim().max(500).optional(),
});

export const CheckoutRequestSchema = z.object({
  checkoutId: z.string().uuid(),
  items: z.array(CheckoutItemSchema).min(1),
  contact: z.object({
    phone: z.string().regex(/^\+7\d{10}$/),
    email: z.string().email().optional(),
  }),
  fulfillment: z.discriminatedUnion("method", [DeliveryFulfillmentSchema, PickupFulfillmentSchema]),
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
export type RestaurantTheme = z.infer<typeof RestaurantThemeSchema>;
export type RestaurantProfileInput = z.infer<typeof RestaurantProfileInputSchema>;
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
  oldPriceKopecks: number | null;
  unitPriceKopecks: number | null;
  priceUnitGrams: number | null;
  weightGrams: number | null;
  displayPriceLabel: string;
  requiresPriceConfirmation: boolean;
  isOrderable: boolean;
  isAvailable: boolean;
  imagePath: string;
  position: number;
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
    profile: RestaurantProfileInput;
    phoneDisplay: string | null;
    phoneHref: string | null;
    leadTimeMinutes: number;
    personalDataLegalBasis: "CONTRACT" | "CONSENT";
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    pickupLabel: string | null;
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

export const CatalogModifierOptionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  priceDeltaKopecks: z.number().int().nonnegative(),
  isAvailable: z.boolean(),
});

export const CatalogModifierGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  kind: z.literal("OTHER"),
  selectionMode: z.enum(["SINGLE", "MULTIPLE"]),
  required: z.boolean(),
  minSelect: z.number().int().nonnegative(),
  maxSelect: z.number().int().positive().nullable(),
  options: z.array(CatalogModifierOptionSchema),
});

export const CatalogProductSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(200),
  compositionText: z.string().max(2_000).nullable(),
  portionNote: z.string().max(500).nullable(),
  pricingType: PricingTypeSchema,
  saleUnit: SaleUnitSchema,
  basePriceKopecks: z.number().int().positive().nullable(),
  oldPriceKopecks: z.number().int().positive().nullable(),
  unitPriceKopecks: z.number().int().positive().nullable(),
  priceUnitGrams: z.number().int().positive().nullable(),
  weightGrams: z.number().int().positive().nullable(),
  displayPriceLabel: z.string().trim().min(1).max(120),
  requiresPriceConfirmation: z.boolean(),
  isOrderable: z.boolean(),
  isAvailable: z.boolean(),
  imagePath: z.string().trim().max(1_000),
  position: z.number().int().nonnegative(),
  modifiers: z.array(CatalogModifierGroupSchema),
});

export const CatalogCategorySchema = z.object({
  id: z.string().uuid(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(160),
  products: z.array(CatalogProductSchema),
});

export const PublicCatalogResponseSchema = z.object({
  categories: z.array(CatalogCategorySchema),
  store: z.object({
    profile: RestaurantProfileInputSchema,
    phoneDisplay: z.string().trim().max(40).nullable(),
    phoneHref: z.string().regex(/^\+\d{7,15}$/).nullable(),
    leadTimeMinutes: z.number().int().positive().max(1_440),
    personalDataLegalBasis: z.enum(["CONTRACT", "CONSENT"]),
    deliveryEnabled: z.boolean(),
    pickupEnabled: z.boolean(),
    pickupLabel: z.string().trim().max(120).nullable(),
    deliveryZones: z.array(z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(120),
      city: z.string().trim().min(1).max(120),
      feeKopecks: z.number().int().nonnegative(),
      freeThresholdKopecks: z.number().int().nonnegative().nullable(),
      minOrderKopecks: z.number().int().nonnegative().nullable(),
    })),
  }),
});

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
