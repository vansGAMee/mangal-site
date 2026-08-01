"use client";

import { useEffect, useState } from "react";

type Status = { publicId: string; paymentStatus: string; fulfillmentStatus: string; updatedAt: string };

export function OrderStatus({ publicId }: { publicId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_PLATFORM_API_URL;
        if (!base) throw new Error("api_unavailable");
        const response = await fetch(`${base}/api/orders/${encodeURIComponent(publicId)}/status`, { credentials: "omit", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("status_unavailable");
        setStatus(await response.json() as Status); setUnavailable(false);
      } catch { if (!controller.signal.aborted) setUnavailable(true); }
      if (!controller.signal.aborted) timer = setTimeout(read, 10_000);
    };
    void read();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [publicId]);
  if (unavailable && !status) return <p role="status" className="border border-white/10 p-5">Статус временно недоступен. Страница попробует снова автоматически.</p>;
  if (!status) return <p role="status" className="mono">Проверяем подтверждение эквайера…</p>;
  return <div aria-live="polite" className="grid gap-5 border border-white/10 p-6 sm:grid-cols-2"><div><span className="eyebrow">Оплата</span><p className="display mt-2 text-4xl">{paymentLabel(status.paymentStatus)}</p></div><div><span className="eyebrow">Заказ</span><p className="display mt-2 text-4xl">{fulfillmentLabel(status.fulfillmentStatus)}</p></div><p className="mono text-xs text-[var(--muted)] sm:col-span-2">Обновлено {new Date(status.updatedAt).toLocaleString("ru-RU")}</p></div>;
}

function paymentLabel(value: string) { return ({ UNPAID: "Не оплачен", PENDING: "Проверяем", PAID: "Оплачен", REFUND_PENDING: "Возврат", REFUNDED: "Возвращён", FAILED: "Ошибка" } as Record<string, string>)[value] ?? value; }
function fulfillmentLabel(value: string) { return ({ NEW: "Новый", CONFIRMED: "Подтверждён", PREPARING: "Готовится", OUT_FOR_DELIVERY: "В пути", COMPLETED: "Доставлен", CANCEL_REQUESTED: "Отмена", CANCELED: "Отменён" } as Record<string, string>)[value] ?? value; }
