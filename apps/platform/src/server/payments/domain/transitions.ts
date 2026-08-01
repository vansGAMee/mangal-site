import type { PaymentAttemptStatus, PaymentStatus } from "../../../../../../generated/prisma/client";
import type { ProviderPaymentState } from "./provider";

export function nextAttemptStatus(current: PaymentAttemptStatus, providerState: ProviderPaymentState["state"]): PaymentAttemptStatus {
  if (current === "SUCCEEDED") return current;
  if (providerState === "SUCCEEDED" || providerState === "REFUNDED") return "SUCCEEDED";
  if (providerState === "FAILED") return "FAILED";
  return current === "REQUIRES_ACTION" ? current : "PROCESSING";
}

export function nextOrderPaymentStatus(current: PaymentStatus, providerState: ProviderPaymentState["state"]): PaymentStatus {
  if (current === "REFUNDED" || current === "REFUND_PENDING") return current;
  if (providerState === "SUCCEEDED") return "PAID";
  if (providerState === "FAILED" && current !== "PAID") return "FAILED";
  if (providerState === "PENDING" && current === "UNPAID") return "PENDING";
  return current;
}
