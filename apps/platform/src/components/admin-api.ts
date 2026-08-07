"use client";

export function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)(?:mangal_csrf_dev|__Host-mangal_csrf)=([^;]*)/);
  return match && match[1] ? decodeURIComponent(match[1]) : "";
}

export async function adminMutation(url: string, method: string, body?: unknown) {
  const token = csrfToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["X-CSRF-Token"] = token;
  }
  const init: RequestInit = {
    method,
    headers,
    credentials: "include",
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const response = await fetch(url, init);
  if (response.status === 401) {
    throw new Error("Сессия истекла. Пожалуйста, войдите снова.");
  }
  if (response.status === 403) {
    throw new Error("Ошибка безопасности (CSRF/Origin). Перезагрузите страницу.");
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: "mutation_failed" }))) as { error?: string };
    throw new Error(error.error ?? "mutation_failed");
  }
  return response.status === 204 ? null : response.json();
}
