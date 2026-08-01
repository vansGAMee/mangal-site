import type { PaymentProvider } from "../../../../../../generated/prisma/client";
import type { PaymentProviderClient } from "../domain/provider";
import { TBankClient } from "../infrastructure/tbank/client";
import { YooKassaClient } from "../infrastructure/yookassa/client";
import { runtimeEnv } from "../../shared/env";

export function providerClient(provider: PaymentProvider): PaymentProviderClient {
  const env = runtimeEnv();
  if (provider === "YOOKASSA") {
    return new YooKassaClient({
      shopId: env.YOOKASSA_SHOP_ID ?? "",
      secretKey: env.YOOKASSA_SECRET_KEY ?? "",
      baseUrl: env.YOOKASSA_API_BASE_URL,
      timeoutMs: env.PAYMENT_HTTP_TIMEOUT_MS,
    });
  }
  return new TBankClient({
    terminalKey: env.TBANK_TERMINAL_KEY ?? "",
    password: env.TBANK_PASSWORD ?? "",
    baseUrl: env.TBANK_API_BASE_URL,
    timeoutMs: env.PAYMENT_HTTP_TIMEOUT_MS,
  });
}
