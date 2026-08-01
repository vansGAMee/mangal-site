import { randomBytes, randomUUID } from "node:crypto";
import type { CheckoutRequest } from "@mangal/contracts";
import { db } from "../shared/db";
import { sha256, stableJson } from "../shared/hash";
import { associatedData, keyedLookup, PiiCipher } from "../crypto/envelope";
import { priceLine, PricingError, type PriceableProduct } from "../catalog/pricing";
import { initializePaymentAttempt, type PaymentConfirmation } from "../payments/application/initialize-payment";
import { ProviderRejectedError, ProviderUnknownResultError } from "../payments/domain/provider";
import { runtimeEnv } from "../shared/env";

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
    if (!attempt) throw new CheckoutError("store_not_configured", 422, "Платёжная попытка заказа отсутствует");
    return initializeOrReturn(attempt.id);
  }

  const [products, zone, settings, routing, pdDocument, marketingDocument, offerDocument, termsDocument] = await Promise.all([
    db.product.findMany({
      where: { id: { in: request.items.map((item) => item.productId) } },
      include: {
        modifierGroups: {
          include: { modifierGroup: { include: { options: true } } },
        },
      },
    }),
    db.deliveryZone.findUnique({ where: { id: request.delivery.zoneId } }),
    db.storeSettings.findUnique({ where: { id: "singleton" } }),
    db.paymentRouting.findUnique({ where: { method: request.paymentMethod } }),
    db.legalDocumentVersion.findUnique({ where: { type_version: { type: "PERSONAL_DATA", version: "pd-v1" } } }),
    db.legalDocumentVersion.findUnique({ where: { type_version: { type: "MARKETING", version: "marketing-v1" } } }),
    db.legalDocumentVersion.findUnique({ where: { type_version: { type: "OFFER", version: "offer-v1" } } }),
    db.legalDocumentVersion.findUnique({ where: { type_version: { type: "TERMS", version: "terms-v1" } } }),
  ]);

  if (!settings || !zone || !zone.isActive || !routing?.isActive || !pdDocument || !marketingDocument || !offerDocument || !termsDocument) {
    throw new CheckoutError("store_not_configured", 422, "Оформление временно недоступно: настройки магазина не завершены");
  }
  if (zone.city.trim().toLocaleLowerCase("ru") !== request.delivery.city.trim().toLocaleLowerCase("ru")) {
    throw new CheckoutError("slot_unavailable", 409, "Адрес не относится к выбранной зоне доставки");
  }
  if (settings.legalBasis === "CONSENT" && request.consents.personalData?.accepted !== true) {
    throw new CheckoutError("consent_required", 422, "Для выбранного основания требуется согласие на обработку персональных данных");
  }
  await validateDeliverySlot(request.delivery.slotStart);

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
      return { request: item, product, priced: priceLine(priceable, item) };
    } catch (error) {
      if (error instanceof PricingError) throw new CheckoutError("catalog_changed", 409, error.message);
      throw error;
    }
  });

  if (!settings.taxSystemCode || pricedItems.some(({ product }) =>
    !product.fiscalVatCode || !product.fiscalPaymentSubject || !product.fiscalPaymentMode || !product.fiscalMeasure)) {
    throw new CheckoutError("store_not_configured", 422, "Фискальные параметры меню требуют подтверждения оператором");
  }

  const subtotalKopecks = pricedItems.reduce((sum, item) => sum + item.priced.lineTotalKopecks, 0);
  const minimum = zone.minOrderKopecks ?? settings.minimumOrderKopecks;
  if (minimum !== null && subtotalKopecks < minimum) {
    throw new CheckoutError("min_order", 422, "Сумма заказа меньше минимальной для выбранной зоны");
  }
  const deliveryFeeKopecks = zone.freeThresholdKopecks !== null && subtotalKopecks >= zone.freeThresholdKopecks
    ? 0
    : zone.feeKopecks;
  const totalKopecks = subtotalKopecks + deliveryFeeKopecks;
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
  const paymentIdempotencyKey = `payment:${attemptId}`;

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
          paymentMethod: request.paymentMethod,
          subtotalKopecks,
          deliveryFeeKopecks,
          totalKopecks,
          deliveryZoneId: zone.id,
          deliverySlotStart: new Date(request.delivery.slotStart),
          phoneEncrypted: encryptOrder("phone", request.contact.phone),
          phoneLookupHash: keyedLookup(request.contact.phone, env.PHONE_LOOKUP_HMAC_KEY!),
          ...(request.contact.email ? { emailEncrypted: encryptOrder("email", request.contact.email) } : {}),
          cityEncrypted: encryptOrder("city", request.delivery.city),
          streetEncrypted: encryptOrder("street", request.delivery.street),
          houseEncrypted: encryptOrder("house", request.delivery.house),
          ...(request.delivery.apartment ? { apartmentEncrypted: encryptOrder("apartment", request.delivery.apartment) } : {}),
          ...(request.delivery.entrance ? { entranceEncrypted: encryptOrder("entrance", request.delivery.entrance) } : {}),
          ...(request.delivery.floor ? { floorEncrypted: encryptOrder("floor", request.delivery.floor) } : {}),
          ...(request.delivery.intercom ? { intercomEncrypted: encryptOrder("intercom", request.delivery.intercom) } : {}),
          ...(request.delivery.comment ? { commentEncrypted: encryptOrder("comment", request.delivery.comment) } : {}),
          taxSystemSnapshot: settings.taxSystemCode!,
          items: {
            create: pricedItems.map(({ product, priced }) => {
              const fiscalName = priced.modifiers.length
                ? `${product.name} (${priced.modifiers.map((modifier) => modifier.optionName).join(", ")})`
                : product.name;
              const fiscalUnitPrice = priced.unitPriceKopecks + priced.modifierTotalPerUnitKopecks;
              const fiscalPayload = {
                fiscalName,
                unitPriceKopecks: fiscalUnitPrice,
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
                  create: { ...fiscalPayload, sourceReceiptPayloadHash: sha256(stableJson(fiscalPayload)) },
                },
              };
            }),
          },
          statusHistory: {
            create: { paymentStatus: "UNPAID", fulfillmentStatus: "NEW", actorType: "CUSTOMER" },
          },
        },
      });

      await tx.legalConsent.createMany({
        data: [
          {
            id: personalConsentId,
            orderId,
            legalDocumentVersionId: pdDocument.id,
            type: "PERSONAL_DATA",
            decision: settings.legalBasis === "CONTRACT" ? "ACKNOWLEDGED" : "GRANTED",
            version: pdDocument.version,
            documentPath: pdDocument.documentPath,
            contentSha256: pdDocument.contentSha256,
            ipEncrypted: cipher.encrypt(evidence.ip, associatedData(personalConsentId, "ip")),
            normalizedUserAgent: evidence.userAgent,
            legalBasis: settings.legalBasis,
          },
          {
            id: marketingConsentId,
            orderId,
            legalDocumentVersionId: marketingDocument.id,
            type: "MARKETING",
            decision: request.consents.marketing.accepted ? "GRANTED" : "DECLINED",
            version: marketingDocument.version,
            documentPath: marketingDocument.documentPath,
            contentSha256: marketingDocument.contentSha256,
            ipEncrypted: cipher.encrypt(evidence.ip, associatedData(marketingConsentId, "ip")),
            normalizedUserAgent: evidence.userAgent,
            legalBasis: "CONSENT",
          },
          {
            id: offerConsentId,
            orderId,
            legalDocumentVersionId: offerDocument.id,
            type: "OFFER",
            decision: "ACKNOWLEDGED",
            version: offerDocument.version,
            documentPath: offerDocument.documentPath,
            contentSha256: offerDocument.contentSha256,
            ipEncrypted: cipher.encrypt(evidence.ip, associatedData(offerConsentId, "ip")),
            normalizedUserAgent: evidence.userAgent,
            legalBasis: "CONTRACT",
          },
          {
            id: termsConsentId,
            orderId,
            legalDocumentVersionId: termsDocument.id,
            type: "TERMS",
            decision: "ACKNOWLEDGED",
            version: termsDocument.version,
            documentPath: termsDocument.documentPath,
            contentSha256: termsDocument.contentSha256,
            ipEncrypted: cipher.encrypt(evidence.ip, associatedData(termsConsentId, "ip")),
            normalizedUserAgent: evidence.userAgent,
            legalBasis: "CONTRACT",
          },
        ],
      });

      await tx.paymentAttempt.create({
        data: {
          id: attemptId,
          orderId,
          provider: routing.provider,
          method: request.paymentMethod,
          idempotencyKey: paymentIdempotencyKey,
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
      if (raced.checkoutRequestHash !== requestHash) throw new CheckoutError("checkout_conflict", 409, "checkoutId уже использован");
      const attempt = raced.paymentAttempts[0];
      if (attempt) return initializeOrReturn(attempt.id);
    }
    throw error;
  }
  return initializeOrReturn(attemptId);
}

async function initializeOrReturn(attemptId: string): Promise<PaymentConfirmation> {
  try {
    return await initializePaymentAttempt(attemptId);
  } catch (error) {
    if (error instanceof ProviderUnknownResultError || error instanceof ProviderRejectedError) {
      throw new CheckoutError("payment_provider_unavailable", 502, "Эквайер не подтвердил создание платежа; заказ сохранён для сверки");
    }
    throw error;
  }
}

async function validateDeliverySlot(slotValue: string): Promise<void> {
  const slot = new Date(slotValue);
  if (!Number.isFinite(slot.getTime()) || slot.getTime() < Date.now() + 5 * 60_000) {
    throw new CheckoutError("slot_unavailable", 409, "Время доставки уже недоступно");
  }
  const timezone = process.env.STORE_TIMEZONE ?? "Europe/Saratov";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(slot);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdays[part("weekday")];
  const hours = weekday === undefined ? null : await db.operatingHours.findUnique({ where: { weekday } });
  if (!hours) throw new CheckoutError("store_not_configured", 422, "Часы работы не настроены");
  if (hours.isClosed || !hours.opensAt || !hours.closesAt) throw new CheckoutError("slot_unavailable", 409, "Заведение закрыто в выбранное время");
  const minute = Number(part("hour")) * 60 + Number(part("minute"));
  const toMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h! * 60 + m!;
  };
  if (minute < toMinutes(hours.opensAt) || minute >= toMinutes(hours.closesAt)) {
    throw new CheckoutError("slot_unavailable", 409, "Время находится вне часов работы");
  }
  if (hours.capacity !== null) {
    const end = new Date(slot.getTime() + hours.slotLength * 60_000);
    const count = await db.order.count({
      where: {
        deliverySlotStart: { gte: slot, lt: end },
        fulfillmentStatus: { not: "CANCELED" },
      },
    });
    if (count >= hours.capacity) throw new CheckoutError("slot_unavailable", 409, "На выбранное время нет свободных слотов");
  }
}
