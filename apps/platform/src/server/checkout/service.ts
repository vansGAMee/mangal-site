import { randomBytes, randomUUID } from "node:crypto";
import type { CheckoutRequest } from "@mangal/contracts";
import { priceLine, PricingError, type PriceableProduct } from "../catalog/pricing";
import { associatedData, keyedLookup, PiiCipher } from "../crypto/envelope";
import { initializePaymentAttempt, type PaymentConfirmation } from "../payments/application/initialize-payment";
import { ProviderRejectedError, ProviderUnknownResultError } from "../payments/domain/provider";
import { db } from "../shared/db";
import { runtimeEnv } from "../shared/env";
import { sha256, stableJson } from "../shared/hash";

export type CheckoutErrorCode =
  | "catalog_changed"
  | "slot_unavailable"
  | "checkout_conflict"
  | "consent_required"
  | "min_order"
  | "payment_provider_unavailable"
  | "store_not_configured";

export class CheckoutError extends Error {
  constructor(readonly code: CheckoutErrorCode, readonly status: number, message: string) {
    super(message);
  }
}

export async function checkout(
  request: CheckoutRequest,
  evidence: { ip: string; userAgent: string },
): Promise<PaymentConfirmation> {
  const requestHash = sha256(stableJson(request));
  const existing = await db.order.findUnique({
    where: { checkoutId: request.checkoutId },
    include: { paymentAttempts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (existing) {
    if (existing.checkoutRequestHash !== requestHash) {
      throw new CheckoutError("checkout_conflict", 409, "checkoutId уже использован для другого запроса");
    }
    const attempt = existing.paymentAttempts[0];
    if (!attempt) {
      throw new CheckoutError("store_not_configured", 422, "У заказа отсутствует платёжная попытка");
    }
    return initializeOrReturn(attempt.id);
  }

  const delivery = request.fulfillment.method === "DELIVERY" ? request.fulfillment : null;
  const isDelivery = delivery !== null;
  const [
    products,
    settings,
    profile,
    routing,
    pdDocument,
    marketingDocument,
    offerDocument,
    termsDocument,
    zone,
  ] = await Promise.all([
    db.product.findMany({
      where: { id: { in: request.items.map((item) => item.productId) } },
      include: {
        modifierGroups: {
          where: { modifierGroup: { isActive: true } },
          include: { modifierGroup: { include: { options: true } } },
        },
      },
    }),
    db.storeSettings.findUnique({ where: { id: "singleton" } }),
    db.restaurantProfile.findUnique({ where: { id: "singleton" } }),
    db.paymentRouting.findUnique({ where: { method: request.paymentMethod } }),
    db.legalDocumentVersion.findUnique({
      where: { type_version: { type: "PERSONAL_DATA", version: "pd-v1" } },
    }),
    db.legalDocumentVersion.findUnique({
      where: { type_version: { type: "MARKETING", version: "marketing-v1" } },
    }),
    db.legalDocumentVersion.findUnique({
      where: { type_version: { type: "OFFER", version: "offer-v1" } },
    }),
    db.legalDocumentVersion.findUnique({
      where: { type_version: { type: "TERMS", version: "terms-v1" } },
    }),
    delivery
      ? db.deliveryZone.findUnique({ where: { id: delivery.zoneId } })
      : Promise.resolve(null),
  ]);

  if (
    !settings ||
    !profile ||
    !routing?.isActive ||
    !pdDocument ||
    !marketingDocument ||
    !offerDocument ||
    !termsDocument
  ) {
    throw new CheckoutError(
      "store_not_configured",
      422,
      "Оформление временно недоступно: обязательные настройки не завершены",
    );
  }

  if (isDelivery) {
    if (!profile.deliveryEnabled || !zone?.isActive) {
      throw new CheckoutError("slot_unavailable", 409, "Доставка в выбранную зону недоступна");
    }
    if (zone.city.trim().toLocaleLowerCase("ru") !== delivery!.city.trim().toLocaleLowerCase("ru")) {
      throw new CheckoutError("slot_unavailable", 409, "Адрес не относится к выбранной зоне доставки");
    }
  } else if (!profile.pickupEnabled) {
    throw new CheckoutError("slot_unavailable", 409, "Самовывоз временно недоступен");
  }

  if (settings.legalBasis === "CONSENT" && request.consents.personalData?.accepted !== true) {
    throw new CheckoutError(
      "consent_required",
      422,
      "Для выбранного правового основания требуется согласие на обработку персональных данных",
    );
  }

  await validateFulfillmentSlot(request.fulfillment.slotStart, profile.timezone);

  const productById = new Map(products.map((product) => [product.id, product]));
  const pricedItems = request.items.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new CheckoutError("catalog_changed", 409, "Состав каталога изменился");
    const priceable: PriceableProduct = {
      id: product.id,
      name: product.name,
      pricingType: product.pricingType,
      saleUnit: product.saleUnit,
      basePriceKopecks: product.basePriceKopecks,
      unitPriceKopecks: product.unitPriceKopecks,
      priceUnitGrams: product.priceUnitGrams,
      requiresPriceConfirmation: product.requiresPriceConfirmation,
      isOrderable: product.isOrderable,
      isAvailable: product.isAvailable,
      modifierGroups: product.modifierGroups.map(({ modifierGroup }) => ({
        id: modifierGroup.id,
        name: modifierGroup.name,
        required: modifierGroup.required,
        minSelect: modifierGroup.minSelect,
        maxSelect: modifierGroup.maxSelect,
        options: modifierGroup.options.map((option) => ({
          id: option.id,
          name: option.name,
          priceDeltaKopecks: option.priceDeltaKopecks,
          isAvailable: option.isAvailable,
        })),
      })),
    };
    try {
      return { product, priced: priceLine(priceable, item) };
    } catch (error) {
      if (error instanceof PricingError) {
        throw new CheckoutError("catalog_changed", 409, error.message);
      }
      throw error;
    }
  });

  if (
    !settings.taxSystemCode ||
    pricedItems.some(
      ({ product }) =>
        !product.fiscalVatCode ||
        !product.fiscalPaymentSubject ||
        !product.fiscalPaymentMode ||
        !product.fiscalMeasure,
    )
  ) {
    throw new CheckoutError(
      "store_not_configured",
      422,
      "Фискальные параметры меню требуют подтверждения оператором",
    );
  }

  const subtotalKopecks = pricedItems.reduce((sum, item) => sum + item.priced.lineTotalKopecks, 0);
  const minimumOrderKopecks = isDelivery
    ? (zone?.minOrderKopecks ?? settings.minimumOrderKopecks)
    : settings.minimumOrderKopecks;
  if (minimumOrderKopecks !== null && subtotalKopecks < minimumOrderKopecks) {
    throw new CheckoutError("min_order", 422, "Сумма заказа меньше минимальной");
  }
  const deliveryFeeKopecks = isDelivery && zone
    ? zone.freeThresholdKopecks !== null && subtotalKopecks >= zone.freeThresholdKopecks
      ? 0
      : zone.feeKopecks
    : 0;
  const totalKopecks = subtotalKopecks + deliveryFeeKopecks;
  const deliveryFiscal = deliveryFeeKopecks > 0
    ? requireDeliveryFiscalSnapshot(deliveryFeeKopecks, settings.taxSystemCode)
    : null;

  const env = runtimeEnv();
  if (!env.PII_KEY_RING_JSON || !env.PHONE_LOOKUP_HMAC_KEY) {
    throw new CheckoutError("store_not_configured", 422, "Ключи защиты персональных данных не настроены");
  }

  const orderId = randomUUID();
  const attemptId = randomUUID();
  const personalConsentId = randomUUID();
  const marketingConsentId = randomUUID();
  const offerConsentId = randomUUID();
  const termsConsentId = randomUUID();
  const cipher = new PiiCipher(env.PII_KEY_RING_JSON);
  const encryptOrder = (field: string, value: string) => cipher.encrypt(value, associatedData(orderId, field));
  const publicId = `MGL-${randomBytes(6).toString("hex").toUpperCase()}`;

  try {
    await db.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          id: orderId,
          publicId,
          checkoutId: request.checkoutId,
          checkoutRequestHash: requestHash,
          paymentStatus: "UNPAID",
          fulfillmentStatus: "NEW",
          fulfillmentMethod: request.fulfillment.method,
          paymentMethod: request.paymentMethod,
          subtotalKopecks,
          deliveryFeeKopecks,
          totalKopecks,
          deliveryZoneId: zone?.id ?? null,
          deliverySlotStart: new Date(request.fulfillment.slotStart),
          phoneEncrypted: encryptOrder("phone", request.contact.phone),
          phoneLookupHash: keyedLookup(request.contact.phone, env.PHONE_LOOKUP_HMAC_KEY!),
          ...(request.contact.email
            ? { emailEncrypted: encryptOrder("email", request.contact.email) }
            : {}),
          ...(delivery
            ? {
                cityEncrypted: encryptOrder("city", delivery.city),
                streetEncrypted: encryptOrder("street", delivery.street),
                houseEncrypted: encryptOrder("house", delivery.house),
                ...(delivery.apartment
                  ? { apartmentEncrypted: encryptOrder("apartment", delivery.apartment) }
                  : {}),
                ...(delivery.entrance
                  ? { entranceEncrypted: encryptOrder("entrance", delivery.entrance) }
                  : {}),
                ...(delivery.floor ? { floorEncrypted: encryptOrder("floor", delivery.floor) } : {}),
                ...(delivery.intercom
                  ? { intercomEncrypted: encryptOrder("intercom", delivery.intercom) }
                  : {}),
              }
            : {}),
          ...(request.fulfillment.comment
            ? { commentEncrypted: encryptOrder("comment", request.fulfillment.comment) }
            : {}),
          taxSystemSnapshot: settings.taxSystemCode!,
          items: {
            create: pricedItems.map(({ product, priced }) => {
              const fiscalName = priced.modifiers.length
                ? `${product.name} (${priced.modifiers.map((modifier) => modifier.optionName).join(", ")})`
                : product.name;
              const fiscalPayload = {
                fiscalName,
                unitPriceKopecks: priced.unitPriceKopecks + priced.modifierTotalPerUnitKopecks,
                quantity: priced.quantity,
                amountKopecks: priced.lineTotalKopecks,
                vatCode: product.fiscalVatCode!,
                taxSystemCode: settings.taxSystemCode!,
                paymentSubject: product.fiscalPaymentSubject!,
                paymentMode: product.fiscalPaymentMode!,
                measure: product.fiscalMeasure!,
              };
              return {
                productId: product.id,
                productVersionSnapshot: product.version,
                nameSnapshot: product.name,
                compositionSnapshot: product.compositionText,
                portionNoteSnapshot: product.portionNote,
                pricingTypeSnapshot: product.pricingType,
                saleUnitSnapshot: product.saleUnit,
                unitPriceKopecks: priced.unitPriceKopecks,
                quantity: priced.quantity,
                lineTotalKopecks: priced.lineTotalKopecks,
                modifiers: {
                  create: priced.modifiers.map((modifier) => ({
                    modifierOptionId: modifier.id,
                    groupNameSnapshot: modifier.groupName,
                    optionNameSnapshot: modifier.optionName,
                    priceDeltaKopecks: modifier.priceDeltaKopecks,
                  })),
                },
                fiscalSnapshot: {
                  create: {
                    ...fiscalPayload,
                    sourceReceiptPayloadHash: sha256(stableJson(fiscalPayload)),
                  },
                },
              };
            }),
          },
          ...(deliveryFiscal
            ? { deliveryFiscalSnapshot: { create: deliveryFiscal } }
            : {}),
          statusHistory: {
            create: { paymentStatus: "UNPAID", fulfillmentStatus: "NEW", actorType: "CUSTOMER" },
          },
        },
      });

      await tx.legalConsent.createMany({
        data: [
          consentRecord({
            id: personalConsentId,
            orderId,
            document: pdDocument,
            type: "PERSONAL_DATA",
            decision: settings.legalBasis === "CONTRACT" ? "ACKNOWLEDGED" : "GRANTED",
            legalBasis: settings.legalBasis,
            cipher,
            evidence,
          }),
          consentRecord({
            id: marketingConsentId,
            orderId,
            document: marketingDocument,
            type: "MARKETING",
            decision: request.consents.marketing.accepted ? "GRANTED" : "DECLINED",
            legalBasis: "CONSENT",
            cipher,
            evidence,
          }),
          consentRecord({
            id: offerConsentId,
            orderId,
            document: offerDocument,
            type: "OFFER",
            decision: "ACKNOWLEDGED",
            legalBasis: "CONTRACT",
            cipher,
            evidence,
          }),
          consentRecord({
            id: termsConsentId,
            orderId,
            document: termsDocument,
            type: "TERMS",
            decision: "ACKNOWLEDGED",
            legalBasis: "CONTRACT",
            cipher,
            evidence,
          }),
        ],
      });

      await tx.paymentAttempt.create({
        data: {
          id: attemptId,
          orderId,
          provider: routing.provider,
          method: request.paymentMethod,
          idempotencyKey: `payment:${attemptId}`,
          amountKopecks: totalKopecks,
          currency: "RUB",
        },
      });
      await tx.outboxEvent.create({
        data: {
          type: "INITIATE_PAYMENT",
          aggregateType: "PaymentAttempt",
          aggregateId: attemptId,
          payload: { paymentAttemptId: attemptId },
        },
      });
    });
  } catch (error) {
    const raced = await db.order.findUnique({
      where: { checkoutId: request.checkoutId },
      include: { paymentAttempts: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (raced) {
      if (raced.checkoutRequestHash !== requestHash) {
        throw new CheckoutError("checkout_conflict", 409, "checkoutId уже использован");
      }
      const attempt = raced.paymentAttempts[0];
      if (attempt) return initializeOrReturn(attempt.id);
    }
    throw error;
  }

  return initializeOrReturn(attemptId);
}

type ConsentDocument = {
  id: string;
  version: string;
  documentPath: string;
  contentSha256: string;
};

function consentRecord(input: {
  id: string;
  orderId: string;
  document: ConsentDocument;
  type: "PERSONAL_DATA" | "MARKETING" | "OFFER" | "TERMS";
  decision: "GRANTED" | "DECLINED" | "ACKNOWLEDGED";
  legalBasis: "CONTRACT" | "CONSENT";
  cipher: PiiCipher;
  evidence: { ip: string; userAgent: string };
}) {
  return {
    id: input.id,
    orderId: input.orderId,
    legalDocumentVersionId: input.document.id,
    type: input.type,
    decision: input.decision,
    version: input.document.version,
    documentPath: input.document.documentPath,
    contentSha256: input.document.contentSha256,
    ipEncrypted: input.cipher.encrypt(input.evidence.ip, associatedData(input.id, "ip")),
    normalizedUserAgent: input.evidence.userAgent,
    legalBasis: input.legalBasis,
  };
}

function requireDeliveryFiscalSnapshot(amountKopecks: number, taxSystemCode: string) {
  const values = {
    vatCode: process.env.FISCAL_DELIVERY_VAT_CODE,
    paymentSubject: process.env.FISCAL_DELIVERY_PAYMENT_SUBJECT,
    paymentMode: process.env.FISCAL_DELIVERY_PAYMENT_MODE,
    measure: process.env.FISCAL_DELIVERY_MEASURE,
  };
  if (!values.vatCode || !values.paymentSubject || !values.paymentMode || !values.measure) {
    throw new CheckoutError(
      "store_not_configured",
      422,
      "Фискальные параметры доставки требуют подтверждения оператором",
    );
  }
  const payload = {
    fiscalName: "Доставка",
    unitPriceKopecks: amountKopecks,
    quantity: 1,
    amountKopecks,
    vatCode: values.vatCode,
    taxSystemCode,
    paymentSubject: values.paymentSubject,
    paymentMode: values.paymentMode,
    measure: values.measure,
  };
  return { ...payload, sourceReceiptPayloadHash: sha256(stableJson(payload)) };
}

async function initializeOrReturn(attemptId: string): Promise<PaymentConfirmation> {
  try {
    return await initializePaymentAttempt(attemptId);
  } catch (error) {
    if (error instanceof ProviderUnknownResultError || error instanceof ProviderRejectedError) {
      throw new CheckoutError(
        "payment_provider_unavailable",
        502,
        "Эквайер не подтвердил создание платежа; заказ сохранён для автоматической сверки",
      );
    }
    throw error;
  }
}

async function validateFulfillmentSlot(slotValue: string, timezone: string): Promise<void> {
  const slot = new Date(slotValue);
  if (!Number.isFinite(slot.getTime()) || slot.getTime() < Date.now() + 5 * 60_000) {
    throw new CheckoutError("slot_unavailable", 409, "Выбранное время уже недоступно");
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(slot);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdays[part("weekday")];
  const hours = weekday === undefined
    ? null
    : await db.operatingHours.findUnique({ where: { weekday } });
  if (!hours) {
    throw new CheckoutError("store_not_configured", 422, "Часы работы не настроены");
  }
  if (hours.isClosed || !hours.opensAt || !hours.closesAt) {
    throw new CheckoutError("slot_unavailable", 409, "Заведение закрыто в выбранное время");
  }
  const minute = Number(part("hour")) * 60 + Number(part("minute"));
  const toMinutes = (value: string) => {
    const [hour, minutes] = value.split(":").map(Number);
    return hour! * 60 + minutes!;
  };
  if (minute < toMinutes(hours.opensAt) || minute >= toMinutes(hours.closesAt)) {
    throw new CheckoutError("slot_unavailable", 409, "Выбранное время находится вне часов работы");
  }
  if (hours.capacity !== null) {
    const end = new Date(slot.getTime() + hours.slotLength * 60_000);
    const count = await db.order.count({
      where: {
        deliverySlotStart: { gte: slot, lt: end },
        fulfillmentStatus: { not: "CANCELED" },
      },
    });
    if (count >= hours.capacity) {
      throw new CheckoutError("slot_unavailable", 409, "На выбранное время нет свободных слотов");
    }
  }
}
