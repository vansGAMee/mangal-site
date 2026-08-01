import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { associatedData, PiiCipher } from "../../apps/platform/src/server/crypto/envelope";

describe("AES-256-GCM envelope", () => {
  it("round-trips with field-bound associated data", () => {
    const key = randomBytes(32).toString("base64");
    const cipher = new PiiCipher(JSON.stringify({ activeKeyId: "k2", keys: { k1: key, k2: key } }));
    const encrypted = cipher.encrypt("+79271061644", associatedData("order-1", "phone"));
    expect(encrypted).toMatchObject({ version: 1, keyId: "k2", algorithm: "AES-256-GCM" });
    expect(cipher.decrypt(encrypted, associatedData("order-1", "phone")).plaintext).toBe("+79271061644");
    expect(() => cipher.decrypt(encrypted, associatedData("order-1", "email"))).toThrow();
  });
});
