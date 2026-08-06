"use client";

export function csrfToken(): string {
  return (
    document.cookie
      .split("; ")
      .find((item) => item.startsWith("mangal_csrf_dev=") || item.startsWith("__Host-mangal_csrf="))
      ?.split("=")[1] ?? ""
  );
}

export async function adminMutation(url: string, method: string, body?: unknown) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken(),
  };
  const init: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const response = await fetch(url, init);
  if (response.status === 401 || response.status === 403) {
    throw new Error("Доступ запрещён или сессия истекла");
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: "mutation_failed" }))) as { error?: string };
    throw new Error(error.error ?? "mutation_failed");
  }
  return response.status === 204 ? null : response.json();
}
