import {
  ProviderConfigurationError,
  ProviderRejectedError,
  ProviderUnknownResultError,
  type InitializedPayment,
  type PaymentInitialization,
  type PaymentProviderClient,
  type ProviderPaymentState,
  type ProviderRefundState,
  type RefundInitialization,
} from "../../domain/provider";
import { createTBankToken } from "./token";

type TBankResponse = {
  Success: boolean;
  ErrorCode: string;
  Message?: string;
  Details?: string;
  TerminalKey?: string;
  Status?: string;
  PaymentId?: string | number;
  OrderId?: string;
  Amount?: number;
  PaymentURL?: string;
  Data?: string;
  RequestKey?: string;
};

export type TBankConfig = {
  terminalKey: string;
  password: string;
  baseUrl: string;
  timeoutMs: number;
};

export class TBankClient implements PaymentProviderClient {
  readonly provider = "TBANK" as const;

  constructor(readonly config: TBankConfig) {
    if (!config.terminalKey || !config.password) throw new ProviderConfigurationError("T-Bank credentials are absent");
  }

  async #request(path: string, payload: Record<string, unknown>): Promise<TBankResponse> {
    const body = { ...payload, Token: createTBankToken(payload, this.config.password) };
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw new ProviderUnknownResultError(error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error");
    }
    const providerRequestId = response.headers.get("x-request-id") ?? undefined;
    if (!response.ok) throw new ProviderUnknownResultError(`http_${response.status}`, providerRequestId);
    let result: TBankResponse;
    try {
      result = (await response.json()) as TBankResponse;
    } catch {
      throw new ProviderUnknownResultError("invalid_json", providerRequestId);
    }
    if (!result.Success) throw new ProviderRejectedError(`tbank_${result.ErrorCode || "rejected"}`);
    return result;
  }

  async initialize(input: PaymentInitialization): Promise<InitializedPayment> {
    const payload = {
      TerminalKey: this.config.terminalKey,
      Amount: input.amountKopecks,
      OrderId: input.orderId,
      Description: `Заказ ${input.orderPublicId}`,
      PayType: "O",
      Language: "ru",
      NotificationURL: input.notificationUrl,
      SuccessURL: input.returnUrl,
      FailURL: input.returnUrl,
      Receipt: {
        ...(input.receipt.customer.email ? { Email: input.receipt.customer.email } : {}),
        ...(input.receipt.customer.phone ? { Phone: input.receipt.customer.phone } : {}),
        Taxation: input.receipt.taxSystemCode,
        FfdVersion: "1.2",
        Items: input.receipt.items.map((item) => ({
          Name: item.name,
          Price: item.unitPriceKopecks,
          Quantity: item.quantity,
          Amount: item.amountKopecks,
          Tax: item.vatCode,
          PaymentMethod: item.paymentMode,
          PaymentObject: item.paymentSubject,
          MeasurementUnit: item.measure,
        })),
      },
      DATA: { orderId: input.orderId, attemptId: input.attemptId },
    };
    const init = await this.#request("Init", payload);
    const paymentId = String(init.PaymentId ?? "");
    if (!paymentId) throw new ProviderUnknownResultError("missing_payment_id");

    let confirmationUrl = init.PaymentURL;
    let confirmationData: string | undefined;
    if (input.method === "SBP") {
      const qr = await this.#request("GetQr", {
        TerminalKey: this.config.terminalKey,
        PaymentId: paymentId,
        DataType: "PAYLOAD",
        PaymentMethod: "SBP",
      });
      confirmationUrl = undefined;
      confirmationData = qr.Data;
    }
    return {
      provider: "TBANK",
      externalPaymentId: paymentId,
      providerStatus: init.Status ?? "NEW",
      amountKopecks: input.amountKopecks,
      currency: "RUB",
      orderId: input.orderId,
      state: mapTBankStatus(init.Status),
      confirmationType: input.method === "SBP" ? "QR" : "REDIRECT",
      ...(confirmationUrl ? { confirmationUrl } : {}),
      ...(confirmationData ? { confirmationData } : {}),
      ...(init.RequestKey ? { providerRequestId: init.RequestKey } : {}),
    };
  }

  async getState(externalPaymentId: string): Promise<ProviderPaymentState> {
    const state = await this.#request("GetState", {
      TerminalKey: this.config.terminalKey,
      PaymentId: externalPaymentId,
    });
    return {
      provider: "TBANK",
      externalPaymentId: String(state.PaymentId ?? externalPaymentId),
      providerStatus: state.Status ?? "UNKNOWN",
      amountKopecks: state.Amount ?? -1,
      currency: "RUB",
      orderId: state.OrderId ?? "",
      state: mapTBankStatus(state.Status),
    };
  }

  async refund(input: RefundInitialization): Promise<ProviderRefundState> {
    const result = await this.#request("Cancel", {
      TerminalKey: this.config.terminalKey,
      PaymentId: input.externalPaymentId,
      Amount: input.amountKopecks,
    });
    const state = mapTBankStatus(result.Status);
    return {
      externalRefundId: String(result.PaymentId ?? input.externalPaymentId),
      providerStatus: result.Status ?? "UNKNOWN",
      state: state === "REFUNDED" ? "SUCCEEDED" : state === "FAILED" ? "FAILED" : "PENDING",
    };
  }

  async getRefundState(externalRefundId: string, externalPaymentId: string): Promise<ProviderRefundState> {
    const state = await this.getState(externalPaymentId);
    return { externalRefundId, providerStatus: state.providerStatus, state: state.state === "REFUNDED" ? "SUCCEEDED" : state.state === "FAILED" ? "FAILED" : "PENDING" };
  }
}

function mapTBankStatus(status?: string): ProviderPaymentState["state"] {
  if (["CONFIRMED", "AUTHORIZED"].includes(status ?? "")) return "SUCCEEDED";
  if (["REFUNDED", "REVERSED"].includes(status ?? "")) return "REFUNDED";
  if (["REJECTED", "DEADLINE_EXPIRED", "CANCELED", "AUTH_FAIL"].includes(status ?? "")) return "FAILED";
  return "PENDING";
}
