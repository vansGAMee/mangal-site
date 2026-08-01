import type { PaymentAttempt } from "../../../../../../generated/prisma/client";
import { db } from "../../shared/db";
import { sha256, stableJson } from "../../shared/hash";
import { ProviderRejectedError, ProviderUnknownResultError } from "../domain/provider";
import { providerClient } from "./provider-factory";

export async function queryPaymentState(attempt: PaymentAttempt) {
  if (!attempt.externalPaymentId) throw new ProviderRejectedError("external_payment_id_missing");
  const operation = await db.paymentOperation.create({ data: { paymentAttemptId: attempt.id, type: "GET_STATE", status: "STARTED", requestHash: sha256(stableJson({ provider: attempt.provider, externalPaymentId: attempt.externalPaymentId })) } });
  const started = performance.now();
  try {
    const result = await providerClient(attempt.provider).getState(attempt.externalPaymentId);
    await db.paymentOperation.update({ where: { id: operation.id }, data: { status: "SUCCEEDED", responseHash: sha256(stableJson(result)), durationMs: Math.round(performance.now() - started), completedAt: new Date() } });
    return result;
  } catch (error) {
    await db.paymentOperation.update({ where: { id: operation.id }, data: { status: error instanceof ProviderUnknownResultError ? "UNKNOWN" : "FAILED", errorCode: error instanceof ProviderUnknownResultError || error instanceof ProviderRejectedError ? error.safeCode : "internal_error", durationMs: Math.round(performance.now() - started), completedAt: new Date() } });
    throw error;
  }
}
