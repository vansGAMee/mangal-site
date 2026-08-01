import { describe, expect, it } from "vitest";
import { createTBankToken, verifyTBankToken } from "../../apps/platform/src/server/payments/infrastructure/tbank/token";
describe("T-Bank SHA-256 Token", () => {
  const payload = { TerminalKey: "TinkoffBankTest", Amount: 100000, OrderId: "21090", Receipt: { Email: "not-in-token@example.test" } };
  it("sorts only root primitive values and adds Password", () => expect(createTBankToken(payload, "TinkoffBankTest")).toBe("382d67e2271245ef365cf465ca1e13af742a11bf2ffe4d05f48e7598c26f8912"));
  it("uses constant-time verification semantics", () => { const Token=createTBankToken(payload,"TinkoffBankTest"); expect(verifyTBankToken({...payload,Token},"TinkoffBankTest")).toBe(true); expect(verifyTBankToken({...payload,Token:`0${Token.slice(1)}`},"TinkoffBankTest")).toBe(false); });
});
