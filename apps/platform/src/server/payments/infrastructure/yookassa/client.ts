import {
  kopecksToRubles,
  ProviderConfigurationError,
  ProviderRejectedError,
  ProviderUnknownResultError,
  rublesToKopecks,
  type InitializedPayment,
  type PaymentInitialization,
  type PaymentProviderClient,
  type ProviderPaymentState,
  type ProviderRefundState,
  type RefundInitialization,
} from "../../domain/provider";

type YooPayment = {
  id: string;
  status: string;
  amount: { value: string; currency: string };
  metadata?: { order_id?: string };
  confirmation?: { type?: string; confirmation_url?: string; confirmation_data?: string };
  cancellation_details?: { reason?: string };
};

type YooRefund = { id: string; status: string; cancellation_details?: { reason?: string } };

export type YooKassaConfig = {
  shopId: string;
  secretKey: string;
  baseUrl: string;
  timeoutMs: number;
};

export class YooKassaClient implements PaymentProviderClient {
  readonly provider = "YOOKASSA" as const;
  readonly #auth: string;

  constructor(readonly config: YooKassaConfig) {
    if (!config.shopId || !config.secretKey) throw new ProviderConfigurationError("YooKassa credentials are absent");
    this.#auth = `Basic ${Buffer.from(`${config.shopId}:${config.secretKey}`).toString("base64")}`;
  }

  async #request<T>(path: string, init: RequestInit, idempotencyKey?: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(this.config.timeoutMs),
        headers: {
          Authorization: this.#auth,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotence-Key": idempotencyKey } : {}),
          ...init.headers,
        },
      });
    } catch (error) {
      throw new ProviderUnknownResultError(error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error");
    }
    const requestId = response.headers.get("x-request-id") ?? undefined;
    if (!response.ok) {
      if (response.status >= 500) throw new ProviderUnknownResultError(`http_${response.status}`, requestId);
      throw new ProviderRejectedError(`http_${response.status}`);
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ProviderUnknownResultError("invalid_json", requestId);
    }
  }

  async initialize(input: PaymentInitialization): Promise<InitializedPayment> {
    const payment = await this.#request<YooPayment>(
      "/payments",
      {
        method: "POST",
        body: JSON.stringify({
          amount: { value: kopecksToRubles(input.amountKopecks), currency: input.currency },
          capture: true,
          payment_method_data: { type: input.method === "SBP" ? "sbp" : "bank_card" },
          confirmation: { type: "redirect", return_url: input.returnUrl },
          description: `Заказ ${input.orderPublicId}`,
          metadata: { order_id: input.orderId, order_public_id: input.orderPublicId },
          receipt: {
            customer: input.receipt.customer,
            tax_system_code: input.receipt.taxSystemCode,
            items: input.receipt.items.map((item) => ({
              description: item.name,
              quantity: item.quantity.toFixed(3),
              amount: { value: kopecksToRubles(item.unitPriceKopecks), currency: "RUB" },
              vat_code: Number(item.vatCode),
              payment_subject: item.paymentSubject,
              payment_mode: item.paymentMode,
              measure: item.measure,
            })),
          },
        }),
      },
      input.idempotencyKey,
    );
    return {
      ...mapYooPayment(payment, input.orderId),
      confirmationType: "REDIRECT",
      ...(payment.confirmation?.confirmation_url ? { confirmationUrl: payment.confirmation.confirmation_url } : {}),
      ...(payment.confirmation?.confirmation_data ? { confirmationData: payment.confirmation.confirmation_data } : {}),
    };
  }

  async getState(externalPaymentId: string): Promise<ProviderPaymentState> {
    return mapYooPayment(await this.#request<YooPayment>(`/payments/${encodeURIComponent(externalPaymentId)}`, { method: "GET" }));
  }

  async refund(input: RefundInitialization): Promise<ProviderRefundState> {
    const refund = await this.#request<YooRefund>(
      "/refunds",
      {
        method: "POST",
        body: JSON.stringify({
          payment_id: input.externalPaymentId,
          amount: { value: kopecksToRubles(input.amountKopecks), currency: input.currency },
          description: `Полный возврат ${input.refundId}`,
          receipt: {
            customer: input.receipt.customer,
            tax_system_code: input.receipt.taxSystemCode,
            items: input.receipt.items.map((item) => ({
              description: item.name,
              quantity: item.quantity.toFixed(3),
              amount: { value: kopecksToRubles(item.unitPriceKopecks), currency: "RUB" },
              vat_code: Number(item.vatCode),
              payment_subject: item.paymentSubject,
              payment_mode: item.paymentMode,
              measure: item.measure,
            })),
          },
        }),
      },
      input.idempotencyKey,
    );
    return {
      externalRefundId: refund.id,
      providerStatus: refund.status,
      state: refund.status === "succeeded" ? "SUCCEEDED" : refund.status === "canceled" ? "FAILED" : "PENDING",
    };
  }

  async getRefundState(externalRefundId: string): Promise<ProviderRefundState> {
    const refund = await this.#request<YooRefund>(`/refunds/${encodeURIComponent(externalRefundId)}`, { method: "GET" });
    return { externalRefundId: refund.id, providerStatus: refund.status, state: refund.status === "succeeded" ? "SUCCEEDED" : refund.status === "canceled" ? "FAILED" : "PENDING" };
  }
}

function mapYooPayment(payment: YooPayment, expectedOrderId?: string): ProviderPaymentState {
  const orderId = payment.metadata?.order_id ?? expectedOrderId;
  if (!orderId) throw new ProviderRejectedError("missing_order_metadata");
  return {
    provider: "YOOKASSA",
    externalPaymentId: payment.id,
    providerStatus: payment.status,
    amountKopecks: rublesToKopecks(payment.amount.value),
    currency: payment.amount.currency,
    orderId,
    state: payment.status === "succeeded" ? "SUCCEEDED" : payment.status === "canceled" ? "FAILED" : "PENDING",
  };
}
