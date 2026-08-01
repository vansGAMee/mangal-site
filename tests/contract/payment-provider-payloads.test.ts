import { afterEach, describe, expect, it, vi } from "vitest";
import { YooKassaClient } from "../../apps/platform/src/server/payments/infrastructure/yookassa/client";
import { TBankClient } from "../../apps/platform/src/server/payments/infrastructure/tbank/client";
import type { PaymentInitialization } from "../../apps/platform/src/server/payments/domain/provider";

const input: PaymentInitialization = {
  attemptId: "7f5d07b4-5d64-4fb5-8ef8-dc7ca74c41b9", idempotencyKey: "payment:attempt", orderId: "2bb537e4-5b6f-4a52-b48b-c2d0ba932c10", orderPublicId: "MGL-ABC123", method: "CARD", amountKopecks: 44_000, currency: "RUB", returnUrl: "https://www.example.test/order/MGL-ABC123", notificationUrl: "https://api.example.test/api/webhooks/tbank",
  receipt: { customer: { phone: "+79271061644" }, taxSystemCode: "operator-confirmed", items: [{ name: "Шаурма", quantity: 2, unitPriceKopecks: 22_000, amountKopecks: 44_000, vatCode: "1", taxSystemCode: "operator-confirmed", paymentSubject: "commodity", paymentMode: "full_payment", measure: "piece" }] },
};

afterEach(() => vi.unstubAllGlobals());

describe("provider payload contracts", () => {
  it("YooKassa sends Basic Auth, Idempotence-Key, one-stage payment and unit receipt amount", async () => {
    let request: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => { request = init; return new Response(JSON.stringify({ id: "provider-payment", status: "pending", amount: { value: "440.00", currency: "RUB" }, metadata: { order_id: input.orderId }, confirmation: { type: "redirect", confirmation_url: "https://pay.example.test" } }), { status: 200, headers: { "Content-Type": "application/json" } }); }));
    await new YooKassaClient({ shopId: "sandbox-shop", secretKey: "sandbox-secret", baseUrl: "https://api.example.test", timeoutMs: 1_000 }).initialize(input);
    const headers = request?.headers as Record<string, string>; const body = JSON.parse(String(request?.body)) as { capture: boolean; receipt: { items: Array<{ quantity: string; amount: { value: string } }> } };
    expect(headers.Authorization).toMatch(/^Basic /); expect(headers["Idempotence-Key"]).toBe(input.idempotencyKey); expect(body.capture).toBe(true); expect(body.receipt.items[0]).toMatchObject({ quantity: "2.000", amount: { value: "220.00" } });
  });

  it("T-Bank uses /Init, PayType O and a root Token", async () => {
    let payload: Record<string, unknown> = {};
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => { payload = JSON.parse(String(init.body)) as Record<string, unknown>; return new Response(JSON.stringify({ Success: true, ErrorCode: "0", PaymentId: "123", Status: "NEW", PaymentURL: "https://pay.example.test", OrderId: input.orderId, Amount: input.amountKopecks }), { status: 200, headers: { "Content-Type": "application/json" } }); }));
    await new TBankClient({ terminalKey: "sandbox-terminal", password: "sandbox-password", baseUrl: "https://securepay.example.test/v2", timeoutMs: 1_000 }).initialize(input);
    expect(payload).toMatchObject({ TerminalKey: "sandbox-terminal", Amount: 44_000, OrderId: input.orderId, PayType: "O" }); expect(payload.Token).toMatch(/^[a-f0-9]{64}$/);
  });
});
