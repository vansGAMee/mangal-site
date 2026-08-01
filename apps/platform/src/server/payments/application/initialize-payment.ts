import { providerClient } from "./provider-factory";
import { applyVerifiedPaymentState } from "./apply-verified-state";
import { associatedData, PiiCipher } from "../../crypto/envelope";
import { runtimeEnv } from "../../shared/env";
import { db } from "../../shared/db";
import { sha256, stableJson } from "../../shared/hash";
import {
  ProviderRejectedError,
  ProviderUnknownResultError,
  type PaymentInitialization,
  type ReceiptItem,
} from "../domain/provider";
import { providerFailures, providerLatency } from "../../observability/metrics";

export type PaymentConfirmation = {
  orderPublicId: string;
  paymentStatus: string;
  confirmationType: string | null;
  confirmationUrl: string | null;
  confirmationData: string | null;
};

export async function initializePaymentAttempt(attemptId: string): Promise<PaymentConfirmation> {
  const changed = await db.paymentAttempt.updateMany({
    where: { id: attemptId, status: { in: ["CREATED", "UNKNOWN"] } },
    data: { status: "INITIALIZING" },
  });
  if (changed.count === 0) return existingConfirmation(attemptId);

  const input = await buildInitialization(attemptId);
  const client = providerClient(input.provider);
  const operation = await db.paymentOperation.create({
    data: {
      paymentAttemptId: attemptId,
      type: "INIT",
      status: "STARTED",
      requestHash: sha256(stableJson({ ...input.payload, receipt: input.payload.receipt.items.map((item) => ({ ...item })) })),
    },
  });
  const started = performance.now();
  const endMetric = providerLatency.startTimer({ provider: input.provider, operation: "init" });
  try {
    const initialized = await client.initialize(input.payload);
    await db.paymentOperation.update({
      where: { id: operation.id },
      data: {
        status: "SUCCEEDED",
        responseHash: sha256(stableJson(initialized)),
        providerRequestId: initialized.providerRequestId ?? null,
        durationMs: Math.round(performance.now() - started),
        completedAt: new Date(),
      },
    });
    await db.paymentAttempt.update({
      where: { id: attemptId },
      data: {
        externalPaymentId: initialized.externalPaymentId,
        providerRequestId: initialized.providerRequestId ?? null,
        confirmationType: initialized.confirmationType,
        confirmationUrl: initialized.confirmationUrl ?? null,
        confirmationData: initialized.confirmationData ?? null,
        status: initialized.state === "SUCCEEDED" ? "SUCCEEDED" : "REQUIRES_ACTION",
        initializedAt: new Date(),
        lastProviderStatus: initialized.providerStatus,
      },
    });
    await applyVerifiedPaymentState(attemptId, initialized);
    await completePaymentOutbox(attemptId);
    endMetric();
    return existingConfirmation(attemptId);
  } catch (error) {
    endMetric();
    const unknown = error instanceof ProviderUnknownResultError;
    providerFailures.inc({ provider: input.provider, operation: "init", code: error instanceof ProviderRejectedError || unknown ? error.safeCode : "internal_error" });
    await db.$transaction([
      db.paymentOperation.update({
        where: { id: operation.id },
        data: {
          status: unknown ? "UNKNOWN" : "FAILED",
          errorCode: error instanceof ProviderRejectedError || unknown ? error.safeCode : "internal_error",
          providerRequestId: unknown ? (error.providerRequestId ?? null) : null,
          durationMs: Math.round(performance.now() - started),
          completedAt: new Date(),
        },
      }),
      db.paymentAttempt.update({
        where: { id: attemptId },
        data: {
          status: unknown ? "UNKNOWN" : "FAILED",
          failureCode: error instanceof ProviderRejectedError || unknown ? error.safeCode : "internal_error",
        },
      }),
      ...(unknown
        ? [
            db.paymentReconciliationTask.create({
              data: { paymentAttemptId: attemptId, reason: error.safeCode },
            }),
          ]
        : []),
    ]);
    if (!unknown) await completePaymentOutbox(attemptId);
    throw error;
  }
}

async function buildInitialization(attemptId: string): Promise<{ provider: "YOOKASSA" | "TBANK"; payload: PaymentInitialization }> {
  const attempt = await db.paymentAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      order: {
        include: {
          items: { include: { fiscalSnapshot: true } },
        },
      },
    },
  });
  const env = runtimeEnv();
  if (!env.PII_KEY_RING_JSON) throw new Error("PII encryption is unavailable");
  const cipher = new PiiCipher(env.PII_KEY_RING_JSON);
  const order = attempt.order;
  const phone = cipher.decrypt(order.phoneEncrypted, associatedData(order.id, "phone")).plaintext;
  const email = order.emailEncrypted
    ? cipher.decrypt(order.emailEncrypted, associatedData(order.id, "email")).plaintext
    : undefined;
  const receiptItems: ReceiptItem[] = order.items.map((item) => {
    if (!item.fiscalSnapshot) throw new Error("Fiscal snapshot is unavailable");
    return {
      name: item.fiscalSnapshot.fiscalName,
      quantity: item.fiscalSnapshot.quantity,
      amountKopecks: item.fiscalSnapshot.amountKopecks,
      unitPriceKopecks: item.fiscalSnapshot.unitPriceKopecks,
      vatCode: item.fiscalSnapshot.vatCode,
      taxSystemCode: item.fiscalSnapshot.taxSystemCode,
      paymentSubject: item.fiscalSnapshot.paymentSubject,
      paymentMode: item.fiscalSnapshot.paymentMode,
      measure: item.fiscalSnapshot.measure,
    };
  });
  if (order.deliveryFeeKopecks > 0) {
    const deliveryFiscal = [
      process.env.FISCAL_DELIVERY_VAT_CODE,
      process.env.FISCAL_DELIVERY_PAYMENT_SUBJECT,
      process.env.FISCAL_DELIVERY_PAYMENT_MODE,
      process.env.FISCAL_DELIVERY_MEASURE,
    ];
    if (deliveryFiscal.some((value) => !value)) throw new Error("Delivery fiscal configuration is unavailable");
    receiptItems.push({
      name: "Доставка",
      quantity: 1,
      amountKopecks: order.deliveryFeeKopecks,
      unitPriceKopecks: order.deliveryFeeKopecks,
      vatCode: deliveryFiscal[0]!,
      taxSystemCode: order.taxSystemSnapshot,
      paymentSubject: deliveryFiscal[1]!,
      paymentMode: deliveryFiscal[2]!,
      measure: deliveryFiscal[3]!,
    });
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const platformUrl = process.env.ADMIN_BASE_URL ?? process.env.PLATFORM_API_URL;
  if (!siteUrl || !platformUrl) throw new Error("Public payment URLs are unavailable");
  return {
    provider: attempt.provider,
    payload: {
      attemptId: attempt.id,
      idempotencyKey: attempt.idempotencyKey,
      orderId: order.id,
      orderPublicId: order.publicId,
      method: attempt.method,
      amountKopecks: attempt.amountKopecks,
      currency: "RUB",
      returnUrl: `${siteUrl}/order/${encodeURIComponent(order.publicId)}`,
      notificationUrl: `${platformUrl}/api/webhooks/${attempt.provider === "YOOKASSA" ? "yookassa" : "tbank"}`,
      receipt: {
        customer: email ? { email, phone } : { phone },
        taxSystemCode: order.taxSystemSnapshot,
        items: receiptItems,
      },
    },
  };
}

async function completePaymentOutbox(attemptId: string): Promise<void> {
  await db.outboxEvent.updateMany({
    where: { type: "INITIATE_PAYMENT", aggregateId: attemptId, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "COMPLETED", completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null },
  });
}

async function existingConfirmation(attemptId: string): Promise<PaymentConfirmation> {
  const attempt = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { order: true } });
  return {
    orderPublicId: attempt.order.publicId,
    paymentStatus: attempt.order.paymentStatus,
    confirmationType: attempt.confirmationType,
    confirmationUrl: attempt.confirmationUrl,
    confirmationData: attempt.confirmationData,
  };
}
