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

const IS_TEST_MODE = process.env.CHECKOUT_TEST_MODE === "true";

export async function checkout(
  request: CheckoutRequest,
  evidence: { ip: string; userAgent: string },
): Promise<PaymentConfirmation> {
  // ----------------------------------------------------------------
  // Idempotency — если уже создавали с тем же checkoutId, отдать то же
  // ----------------------------------------------------------------
  const requestHash = sha256(stableJson(request));
  const existing = await db.order.findUnique({
    where: { checkoutId: request.checkoutId },
    include: { paymentAttempts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (existing) {
    if (existing.checkoutRequestHash !== requestHash) {
      throw new CheckoutError("checkout_conflict", 409, "checkoutId уже использован для другого запроса");
    }
    if (IS_TEST_MODE) {
      return testModeConfirmation(existing.publicId, existing.paymentStatus);
    }
    const attempt = existing.paymentAttempts[0];
    if (!attempt) throw new CheckoutError("store_not_configured", 422, "Платёжная попытка заказа отсутствует");
    return initializeOrReturn(attempt.id);
  }

  // ----------------------------------------------------------------
  // Ценообразование — всегда нужно; не трогает конфиг-таблицы
  // ----------------------------------------------------------------
  const products = await db.product.findMany({
    where: { id: { in: request.items.map((item) => item.productId) } },
    include: {
      modifierGroups: {
        include: { modifierGroup: { include: { options: true } } },
      },
    },
  });

  const productById = new Map(products.map((p) => [p.id, p]));
  const pricedItems = request.items.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new CheckoutError("catalog_changed", 409, "Товар отсутствует в каталоге");
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
        options: modifierGroup.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceDeltaKopecks: o.priceDeltaKopecks,
          isAvailable: o.isAvailable,
        })),
      })),
    };
    try {
      return { product, priced: priceLine(priceable, item) };
    } catch (e) {
      if (e instanceof PricingError) throw new CheckoutError("catalog_changed", 409, e.message);
      throw e;
    }
  });

  const subtotalKopecks = pricedItems.reduce((s, i) => s + i.priced.lineTotalKopecks, 0);

  // ----------------------------------------------------------------
  // TEST MODE — пропускаем ВСЕ production-readiness проверки:
  //   - validateDeliverySlot (OperatingHours)
  //   - zone/routing/settings checks
  //   - LegalConsent creation (FK dependence)
  //   - Payment init
  // ----------------------------------------------------------------
  if (IS_TEST_MODE) {
    return createTestOrder(request, evidence, pricedItems, subtotalKopecks);
  }

  // ----------------------------------------------------------------
  // PRODUCTION MODE — полные проверки
  // ----------------------------------------------------------------
  const [settings, zone, routing, pdDocument, marketingDocument, offerDocument, termsDocument] = await Promise.all([
    db.storeSettings.findUnique({ where: { id: "singleton" } }),
    db.deliveryZone.findUnique({ where: { id: request.delivery.zoneId } }),
    db.paymentRouting.findUnique({ where: { method: request.paymentMethod } }),
    db.legalDocumentVersion.findUnique({ where: { type_version: { type: "PERSONAL_DATA", version: "pd-v1" } } }),
    db.legalDocumentVersion.findUnique({ where: { type_version: { type: "MARKETING", version: "marketing-v1" } } }),
    db.legalDocumentVersion.findUnique({ where: { type_version: { type: "OFFER", version: "offer-v1" } } }),
    db.legalDocumentVersion.findUnique({ where: { type_version: { type: "TERMS", version: "terms-v1" } } }),
  ]);

  if (!settings || !zone || !zone.isActive || !routing?.isActive) {
    throw new CheckoutError("store_not_configured", 422, "Оформление временно недоступно: настройки магазина не завершены");
  }
  if (!pdDocument || !marketingDocument || !offerDocument || !termsDocument) {
    throw new CheckoutError("store_not_configured", 422, "Юридические документы не опубликованы");
  }
  if (settings.legalBasis === "CONSENT" && request.consents.personalData?.accepted !== true) {
    throw new CheckoutError("consent_required", 422, "Для выбранного основания требуется согласие на обработку персональных данных");
  }
  if (zone.city.trim().toLocaleLowerCase("ru") !== request.delivery.city.trim().toLocaleLowerCase("ru")) {
    throw new CheckoutError("slot_unavailable", 409, "Адрес не относится к выбранной зоне доставки");
  }
  if (!settings.taxSystemCode || pricedItems.some(({ product }) =>
    !product.fiscalVatCode || !product.fiscalPaymentSubject || !product.fiscalPaymentMode || !product.fiscalMeasure)) {
    throw new CheckoutError("store_not_configured", 422, "Фискальные параметры меню требуют подтверждения оператором");
  }

  await validateDeliverySlot(request.delivery.slotStart);

  const minimum = zone.minOrderKopecks ?? settings.minimumOrderKopecks;
  if (minimum !== null && subtotalKopecks < minimum) {
    throw new CheckoutError("min_order", 422, "Сумма заказа меньше минимальной для выбранной зоны");
  }

  const env = runtimeEnv();
  if (!env.PII_KEY_RING_JSON || !env.PHONE_LOOKUP_HMAC_KEY) {
    throw new CheckoutError("store_not_configured", 422, "Ключи защиты персональных данных не настроены");
  }

  const deliveryFeeKopecks = zone.freeThresholdKopecks !== null && subtotalKopecks >= zone.freeThresholdKopecks
    ? 0
    : zone.feeKopecks;
  const totalKopecks = subtotalKopecks + deliveryFeeKopecks;
  const taxSystemCode = settings.taxSystemCode;

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
          taxSystemSnapshot: taxSystemCode,
          isTest: false,
          items: {
            create: pricedItems.map(({ product, priced }) => buildOrderItem(product, priced, taxSystemCode)),
          },
          statusHistory: {
            create: { paymentStatus: "UNPAID", fulfillmentStatus: "NEW", actorType: "CUSTOMER" },
          },
        },
      });

      const consentsData = [
        {
          id: personalConsentId,
          orderId,
          legalDocumentVersionId: pdDocument.id,
          type: "PERSONAL_DATA" as const,
          decision: settings.legalBasis === "CONTRACT" ? ("ACKNOWLEDGED" as const) : ("GRANTED" as const),
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
          type: "MARKETING" as const,
          decision: request.consents.marketing.accepted ? ("GRANTED" as const) : ("DECLINED" as const),
          version: marketingDocument.version,
          documentPath: marketingDocument.documentPath,
          contentSha256: marketingDocument.contentSha256,
          ipEncrypted: cipher.encrypt(evidence.ip, associatedData(marketingConsentId, "ip")),
          normalizedUserAgent: evidence.userAgent,
          legalBasis: "CONSENT" as const,
        },
        {
          id: offerConsentId,
          orderId,
          legalDocumentVersionId: offerDocument.id,
          type: "OFFER" as const,
          decision: "GRANTED" as const,
          version: offerDocument.version,
          documentPath: offerDocument.documentPath,
          contentSha256: offerDocument.contentSha256,
          ipEncrypted: cipher.encrypt(evidence.ip, associatedData(offerConsentId, "ip")),
          normalizedUserAgent: evidence.userAgent,
          legalBasis: "CONTRACT" as const,
        },
        {
          id: termsConsentId,
          orderId,
          legalDocumentVersionId: termsDocument.id,
          type: "TERMS" as const,
          decision: "GRANTED" as const,
          version: termsDocument.version,
          documentPath: termsDocument.documentPath,
          contentSha256: termsDocument.contentSha256,
          ipEncrypted: cipher.encrypt(evidence.ip, associatedData(termsConsentId, "ip")),
          normalizedUserAgent: evidence.userAgent,
          legalBasis: "CONTRACT" as const,
        },
      ];

      await tx.legalConsent.createMany({ data: consentsData });
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

// ----------------------------------------------------------------
// TEST MODE order creation — никаких LegalConsents, никакого эквайера
// ----------------------------------------------------------------
async function createTestOrder(
  request: CheckoutRequest,
  evidence: { ip: string; userAgent: string },
  pricedItems: Array<{ product: Awaited<ReturnType<typeof db.product.findMany>>[0] & { modifierGroups: unknown[] }; priced: ReturnType<typeof priceLine> }>,
  subtotalKopecks: number,
): Promise<PaymentConfirmation> {
  const env = runtimeEnv();
  // Fallback PII keys — только для теста, не для продакшна
  const piiKeyRing = env.PII_KEY_RING_JSON ?? '{"activeKeyId":"key1","keys":{"key1":"dGVzdC1rZXktZm9yLWRldmVsb3BtZW50LW9ubHk="}}';
  const phoneHmacKey = env.PHONE_LOOKUP_HMAC_KEY ?? "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  // Найти любую зону — используем существующую из БД или подставляем нулевой UUID только для FK
  const zone = await db.deliveryZone.findFirst({ where: { isActive: true } })
    ?? await db.deliveryZone.findFirst();
  if (!zone) {
    throw new CheckoutError("store_not_configured", 422, "TEST MODE: в БД нет ни одной зоны доставки. Создайте одну в /admin/delivery-zones.");
  }

  const orderId = randomUUID();
  const cipher = new PiiCipher(piiKeyRing);
  const encryptOrder = (field: string, value: string) => cipher.encrypt(value, associatedData(orderId, field));
  const publicId = `MGL-${randomBytes(6).toString("hex").toUpperCase()}`;
  const taxSystemCode = "0";

  await db.$transaction(async (tx) => {
    await tx.order.create({
      data: {
        id: orderId,
        publicId,
        checkoutId: request.checkoutId,
        checkoutRequestHash: sha256(stableJson(request)),
        paymentStatus: "UNPAID",
        fulfillmentStatus: "NEW",
        paymentMethod: request.paymentMethod,
        subtotalKopecks,
        deliveryFeeKopecks: 0,
        totalKopecks: subtotalKopecks,
        deliveryZoneId: zone.id,
        // Время слота: используем переданное или +15 минут от сейчас
        deliverySlotStart: (() => {
          const d = new Date(request.delivery.slotStart);
          return Number.isFinite(d.getTime()) ? d : new Date(Date.now() + 15 * 60_000);
        })(),
        phoneEncrypted: encryptOrder("phone", request.contact.phone),
        phoneLookupHash: keyedLookup(request.contact.phone, phoneHmacKey),
        ...(request.contact.email ? { emailEncrypted: encryptOrder("email", request.contact.email) } : {}),
        cityEncrypted: encryptOrder("city", request.delivery.city || "Воронеж"),
        streetEncrypted: encryptOrder("street", request.delivery.street || "Самовывоз"),
        houseEncrypted: encryptOrder("house", request.delivery.house || "1"),
        ...(request.delivery.comment ? { commentEncrypted: encryptOrder("comment", request.delivery.comment) } : {}),
        taxSystemSnapshot: taxSystemCode,
        isTest: true,
        items: {
          create: pricedItems.map(({ product, priced }) => buildOrderItem(product, priced, taxSystemCode)),
        },
        statusHistory: {
          create: { paymentStatus: "UNPAID", fulfillmentStatus: "NEW", actorType: "CUSTOMER" },
        },
      },
    });
    // LegalConsent — не создаём, ждём production setup
  });

  return testModeConfirmation(publicId, "UNPAID");
}

function testModeConfirmation(publicId: string, paymentStatus: string): PaymentConfirmation {
  return {
    orderPublicId: publicId,
    paymentStatus,
    confirmationType: "TEST_MODE",
    confirmationUrl: null,
    confirmationData: null,
  };
}

// ----------------------------------------------------------------
// Production payment helpers
// ----------------------------------------------------------------
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
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdays[part("weekday")];
  const hours = weekday === undefined ? null : await db.operatingHours.findUnique({ where: { weekday } });
  if (!hours) throw new CheckoutError("store_not_configured", 422, "Часы работы не настроены");
  if (hours.isClosed || !hours.opensAt || !hours.closesAt) {
    throw new CheckoutError("slot_unavailable", 409, "Заведение закрыто в выбранное время");
  }
  const minute = Number(part("hour")) * 60 + Number(part("minute"));
  const toMin = (v: string) => { const [h, m] = v.split(":").map(Number); return h! * 60 + m!; };
  if (minute < toMin(hours.opensAt) || minute >= toMin(hours.closesAt)) {
    throw new CheckoutError("slot_unavailable", 409, "Время находится вне часов работы");
  }
  if (hours.capacity !== null) {
    const end = new Date(slot.getTime() + hours.slotLength * 60_000);
    const count = await db.order.count({
      where: { deliverySlotStart: { gte: slot, lt: end }, fulfillmentStatus: { not: "CANCELED" } },
    });
    if (count >= hours.capacity) throw new CheckoutError("slot_unavailable", 409, "На выбранное время нет свободных слотов");
  }
}

// ----------------------------------------------------------------
// Shared helper — строит данные для OrderItem из priced line
// ----------------------------------------------------------------
function buildOrderItem(
  product: { id: string; name: string; fiscalVatCode: string | null; fiscalPaymentSubject: string | null; fiscalPaymentMode: string | null; fiscalMeasure: string | null; version: number; compositionText: string | null; portionNote: string | null; pricingType: string; saleUnit: string },
  priced: ReturnType<typeof priceLine>,
  taxSystemCode: string,
) {
  const fiscalName = priced.modifiers.length
    ? `${product.name} (${priced.modifiers.map((m) => m.optionName).join(", ")})`
    : product.name;
  const fiscalUnitPrice = priced.unitPriceKopecks + priced.modifierTotalPerUnitKopecks;
  const fiscalPayload = {
    fiscalName,
    unitPriceKopecks: fiscalUnitPrice,
    quantity: priced.quantity,
    amountKopecks: priced.lineTotalKopecks,
    vatCode: product.fiscalVatCode ?? "1",
    taxSystemCode,
    paymentSubject: product.fiscalPaymentSubject ?? "1",
    paymentMode: product.fiscalPaymentMode ?? "1",
    measure: product.fiscalMeasure ?? "1",
  };
  return {
    productId: product.id,
    productVersionSnapshot: product.version,
    nameSnapshot: product.name,
    compositionSnapshot: product.compositionText,
    portionNoteSnapshot: product.portionNote,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pricingTypeSnapshot: product.pricingType as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    saleUnitSnapshot: product.saleUnit as any,
    unitPriceKopecks: priced.unitPriceKopecks,
    quantity: priced.quantity,
    lineTotalKopecks: priced.lineTotalKopecks,
    modifiers: {
      create: priced.modifiers.map((m) => ({
        modifierOptionId: m.id,
        groupNameSnapshot: m.groupName,
        optionNameSnapshot: m.optionName,
        priceDeltaKopecks: m.priceDeltaKopecks,
      })),
    },
    fiscalSnapshot: {
      create: { ...fiscalPayload, sourceReceiptPayloadHash: sha256(stableJson(fiscalPayload)) },
    },
  };
}
