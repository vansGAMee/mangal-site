import { describe, expect, it } from "vitest";
import { nextAttemptStatus, nextOrderPaymentStatus } from "../../apps/platform/src/server/payments/domain/transitions";
describe("payment state monotonicity", () => {
  it("does not regress a succeeded attempt", () => expect(nextAttemptStatus("SUCCEEDED", "FAILED")).toBe("SUCCEEDED"));
  it("does not overwrite refund states with a late payment callback", () => { expect(nextOrderPaymentStatus("REFUND_PENDING", "SUCCEEDED")).toBe("REFUND_PENDING"); expect(nextOrderPaymentStatus("REFUNDED", "PENDING")).toBe("REFUNDED"); });
  it("maps verified success independently from fulfillment", () => expect(nextOrderPaymentStatus("PENDING", "SUCCEEDED")).toBe("PAID"));
});
