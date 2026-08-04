import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const platform = process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "";
  const mediaOrigin = safeOrigin(process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? platform);
  const platformOrigin = safeOrigin(platform);
  const developmentEval = process.env.NODE_ENV === "production" ? "" : "'unsafe-eval'";
  const connectSources = ["'self'", platformOrigin, "https://mc.yandex.ru"].filter(Boolean).join(" ");
  const imageSources = ["'self'", "data:", "blob:", mediaOrigin, "https://*.public.blob.vercel-storage.com", "https://mc.yandex.ru"]
    .filter(Boolean)
    .join(" ");
  const csp = [
    "default-src 'self'",
    `script-src ${["'self'", `'nonce-${nonce}'`, developmentEval, "https://mc.yandex.ru"].filter(Boolean).join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imageSources}`,
    `connect-src ${connectSources}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (process.env.NODE_ENV === "production") response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  return response;
}

export const config = { matcher: [{ source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)", missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] }] };

function safeOrigin(value: string): string {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}
