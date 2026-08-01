import { createHash } from "node:crypto";
import { secureTokenEquals } from "../../../crypto/envelope";

type TBankPrimitive = string | number | boolean | null | undefined;

export function createTBankToken(payload: Record<string, unknown>, password: string): string {
  const flat: Record<string, TBankPrimitive> = { Password: password };
  for (const [key, value] of Object.entries(payload)) {
    if (key === "Token" || typeof value === "object") continue;
    if (["string", "number", "boolean"].includes(typeof value)) flat[key] = value as string | number | boolean;
  }
  const concatenated = Object.keys(flat)
    .sort()
    .map((key) => String(flat[key] ?? ""))
    .join("");
  return createHash("sha256").update(concatenated, "utf8").digest("hex");
}

export function verifyTBankToken(payload: Record<string, unknown>, password: string): boolean {
  const token = typeof payload.Token === "string" ? payload.Token.toLowerCase() : "";
  return secureTokenEquals(token, createTBankToken(payload, password));
}
