import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { EncryptedValueSchema, type EncryptedValue } from "@mangal/contracts";

type KeyRing = {
  activeKeyId: string;
  keys: Record<string, string>;
};

export class EncryptionConfigurationError extends Error {}

export class PiiCipher {
  readonly #activeKeyId: string;
  readonly #keys: Map<string, Buffer>;

  constructor(keyRingJson: string) {
    let parsed: KeyRing;
    try {
      parsed = JSON.parse(keyRingJson) as KeyRing;
    } catch {
      throw new EncryptionConfigurationError("PII key ring is not valid JSON");
    }
    if (!parsed.activeKeyId || !parsed.keys?.[parsed.activeKeyId]) {
      throw new EncryptionConfigurationError("PII key ring has no active key");
    }
    this.#activeKeyId = parsed.activeKeyId;
    this.#keys = new Map(
      Object.entries(parsed.keys).map(([keyId, encoded]) => {
        const key = Buffer.from(encoded, "base64");
        if (key.length !== 32) throw new EncryptionConfigurationError(`PII key ${keyId} must contain 32 bytes`);
        return [keyId, key];
      }),
    );
  }

  encrypt(plaintext: string, associatedData: string): EncryptedValue {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.#keys.get(this.#activeKeyId)!, nonce);
    cipher.setAAD(Buffer.from(associatedData, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return {
      version: 1,
      keyId: this.#activeKeyId,
      algorithm: "AES-256-GCM",
      nonce: nonce.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
    };
  }

  decrypt(valueInput: unknown, associatedData: string): { plaintext: string; needsRotation: boolean } {
    const value = EncryptedValueSchema.parse(valueInput);
    const key = this.#keys.get(value.keyId);
    if (!key) throw new EncryptionConfigurationError(`PII key ${value.keyId} is unavailable`);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.nonce, "base64"));
    decipher.setAAD(Buffer.from(associatedData, "utf8"));
    decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return { plaintext, needsRotation: value.keyId !== this.#activeKeyId || value.version !== 1 };
  }
}

export function associatedData(entityId: string, fieldName: string, schemaVersion = 1): string {
  return `${entityId}:${fieldName}:${schemaVersion}`;
}

export function keyedLookup(value: string, base64Key: string): string {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new EncryptionConfigurationError("Lookup HMAC key must contain 32 bytes");
  return createHmac("sha256", key).update(value).digest("hex");
}

export function secureTokenEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
