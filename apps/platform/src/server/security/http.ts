import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { ApiErrorCode, ApiErrorResponse } from "@mangal/contracts";
import { allowedStorefrontOrigins } from "../shared/env";

export const MAX_CHECKOUT_BODY_BYTES = 32 * 1024;
export const MAX_WEBHOOK_BODY_BYTES = 128 * 1024;
export const MAX_ADMIN_JSON_BODY_BYTES = 64 * 1024;

export function requestId(request: Request): string {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[a-zA-Z0-9_-]{8,80}$/.test(supplied) ? supplied : randomUUID();
}

export function apiError(code: ApiErrorCode, status: number, requestIdValue: string, message: string): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: { code, message, requestId: requestIdValue } },
    { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestIdValue } },
  );
}

export function validateStorefrontOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  return origin && allowedStorefrontOrigins().has(origin) ? origin : null;
}

export function corsHeaders(origin: string, methods = "POST, OPTIONS"): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, X-Request-Id",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export async function readLimitedBody(request: Request, limit: number): Promise<string> {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(await readLimitedBytes(request, limit));
  } catch (error) {
    if (error instanceof BodyTooLargeError) throw error;
    throw new MalformedBodyError();
  }
}

export async function readJsonBody(request: Request, limit = MAX_ADMIN_JSON_BODY_BYTES): Promise<unknown> {
  return JSON.parse(await readLimitedBody(request, limit)) as unknown;
}

export async function readLimitedBytes(request: Request, limit: number): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > limit) throw new BodyTooLargeError();
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export class BodyTooLargeError extends Error {}
export class MalformedBodyError extends Error {}

export function clientIp(request: Request): string {
  const policy = process.env.TRUSTED_PROXY_POLICY;
  if (policy === "YANDEX") return request.headers.get("x-real-ip")?.trim() || "unavailable";
  if (policy === "VERIFIED_X_FORWARDED_FOR") return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unavailable";
  return "unavailable";
}

export function normalizeUserAgent(value: string | null): string {
  return (value ?? "unknown")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 512);
}
