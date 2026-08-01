export type ReceiptItem = {
  name: string;
  quantity: number;
  amountKopecks: number;
  unitPriceKopecks: number;
  vatCode: string;
  taxSystemCode: string;
  paymentSubject: string;
  paymentMode: string;
  measure: string;
};

export type PaymentInitialization = {
  attemptId: string;
  idempotencyKey: string;
  orderId: string;
  orderPublicId: string;
  method: "CARD" | "SBP";
  amountKopecks: number;
  currency: "RUB";
  returnUrl: string;
  notificationUrl: string;
  receipt: {
    customer: { email?: string; phone?: string };
    taxSystemCode: string;
    items: ReceiptItem[];
  };
};

export type ProviderPaymentState = {
  provider: "YOOKASSA" | "TBANK";
  externalPaymentId: string;
  providerStatus: string;
  amountKopecks: number;
  currency: string;
  orderId: string;
  state: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
};

export type InitializedPayment = ProviderPaymentState & {
  confirmationType: "REDIRECT" | "QR";
  confirmationUrl?: string;
  confirmationData?: string;
  providerRequestId?: string;
};

export type RefundInitialization = {
  refundId: string;
  idempotencyKey: string;
  externalPaymentId: string;
  amountKopecks: number;
  currency: "RUB";
  receipt: PaymentInitialization["receipt"];
};

export type ProviderRefundState = {
  externalRefundId: string;
  providerStatus: string;
  state: "PENDING" | "SUCCEEDED" | "FAILED";
};

export interface PaymentProviderClient {
  readonly provider: "YOOKASSA" | "TBANK";
  initialize(input: PaymentInitialization): Promise<InitializedPayment>;
  getState(externalPaymentId: string): Promise<ProviderPaymentState>;
  refund(input: RefundInitialization): Promise<ProviderRefundState>;
  getRefundState(externalRefundId: string, externalPaymentId: string): Promise<ProviderRefundState>;
}

export class ProviderConfigurationError extends Error {}

export class ProviderRejectedError extends Error {
  constructor(readonly safeCode: string) {
    super("Payment provider rejected the operation");
  }
}

export class ProviderUnknownResultError extends Error {
  constructor(readonly safeCode: string, readonly providerRequestId?: string) {
    super("Payment provider result is unknown");
  }
}

export function kopecksToRubles(kopecks: number): string {
  if (!Number.isSafeInteger(kopecks) || kopecks < 0) throw new Error("Invalid kopeck amount");
  return `${Math.floor(kopecks / 100)}.${String(kopecks % 100).padStart(2, "0")}`;
}

export function rublesToKopecks(value: string): number {
  if (!/^\d+\.\d{2}$/.test(value)) throw new ProviderRejectedError("invalid_provider_amount");
  const [rubles, kopecks] = value.split(".");
  const result = Number(rubles) * 100 + Number(kopecks);
  if (!Number.isSafeInteger(result)) throw new ProviderRejectedError("invalid_provider_amount");
  return result;
}
