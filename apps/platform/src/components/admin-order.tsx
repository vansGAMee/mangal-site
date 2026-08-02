"use client";

import { formatRubles } from "@mangal/design-system";
import { useCallback, useEffect, useState } from "react";
import { adminMutation } from "./admin-api";

type Order = {
  id: string;
  publicId: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  fulfillmentMethod: "DELIVERY" | "PICKUP";
  totalKopecks: number;
  version: number;
  deliverySlotStart: string;
  contact: { phone: string; email: string | null };
  delivery: Record<string, string | null>;
  items: Array<{
    id: string;
    nameSnapshot: string;
    quantity: number;
    lineTotalKopecks: number;
    modifiers: Array<{ optionNameSnapshot: string }>;
  }>;
  statusHistory: Array<{
    id: string;
    paymentStatus: string;
    fulfillmentStatus: string;
    createdAt: string;
  }>;
  paymentAttempts: Array<{
    id: string;
    provider: string;
    method: string;
    status: string;
    externalPaymentId: string | null;
  }>;
  refunds: Array<{
    id: string;
    status: string;
    amountKopecks: number;
    reason: string;
  }>;
};

export function AdminOrder({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
    if (response.status === 401) {
      location.assign("/admin/login");
      return;
    }
    if (!response.ok) {
      setMessage("Не удалось загрузить заказ");
      return;
    }
    setOrder((await response.json()) as Order);
  }, [orderId]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  if (!order) return <p>Загрузка заказа…</p>;
  const currentOrder = order;

  async function updateStatus(fulfillmentStatus: string) {
    try {
      await adminMutation(`/api/admin/orders/${currentOrder.id}/status`, "PATCH", {
        version: currentOrder.version,
        fulfillmentStatus,
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка");
    }
  }

  async function cancel(form: HTMLFormElement) {
    const formData = new FormData(form);
    try {
      await adminMutation(`/api/admin/orders/${currentOrder.id}/cancel`, "POST", {
        version: currentOrder.version,
        reason: formData.get("reason"),
      });
      setMessage("Запрос принят; оплаченный заказ будет отменён только после подтверждённого полного возврата");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка");
    }
  }

  const address = [
    currentOrder.delivery.city,
    currentOrder.delivery.street,
    currentOrder.delivery.house,
    currentOrder.delivery.apartment,
  ].filter(Boolean).join(", ");

  return (
    <section style={{ padding: "30px 0" }}>
      <h1>{currentOrder.publicId}</h1>
      <p>
        {currentOrder.paymentStatus} · {currentOrder.fulfillmentStatus} · {formatRubles(currentOrder.totalKopecks)} · v{currentOrder.version}
      </p>
      {message ? <p role="status">{message}</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
        <article className="admin-card">
          <h2>Контакт и получение</h2>
          <p><strong>{currentOrder.fulfillmentMethod === "PICKUP" ? "Самовывоз" : "Доставка"}</strong></p>
          <p>{currentOrder.contact.phone}<br />{currentOrder.contact.email}</p>
          {currentOrder.fulfillmentMethod === "DELIVERY" ? <p>{address}</p> : null}
          <p>Ко времени: {new Date(currentOrder.deliverySlotStart).toLocaleString("ru-RU")}</p>
          {currentOrder.delivery.comment ? <p>{currentOrder.delivery.comment}</p> : null}
        </article>

        <article className="admin-card">
          <h2>Платёж</h2>
          {currentOrder.paymentAttempts.map((attempt) => (
            <p key={attempt.id}>
              {attempt.provider} · {attempt.method} · {attempt.status}<br />
              <small>{attempt.externalPaymentId ?? "external ID ожидается"}</small>
            </p>
          ))}
          {currentOrder.refunds.map((refund) => (
            <p key={refund.id}>Возврат {refund.status} · {formatRubles(refund.amountKopecks)} · {refund.reason}</p>
          ))}
        </article>
      </div>

      <h2>Позиции</h2>
      {currentOrder.items.map((item) => (
        <div className="admin-card" key={item.id}>
          {item.nameSnapshot} × {item.quantity} · {formatRubles(item.lineTotalKopecks)}
          <small style={{ display: "block" }}>{item.modifiers.map((modifier) => modifier.optionNameSnapshot).join(", ")}</small>
        </div>
      ))}

      <h2>Workflow</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(currentOrder.fulfillmentMethod === "PICKUP"
          ? ["CONFIRMED", "PREPARING", "COMPLETED"]
          : ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "COMPLETED"]
        ).map((value) => (
          <button className="admin-button" key={value} onClick={() => void updateStatus(value)} type="button">{value}</button>
        ))}
      </div>

      <form className="admin-card" style={{ marginTop: 20 }} onSubmit={(event) => {
        event.preventDefault();
        void cancel(event.currentTarget);
      }}>
        <h2>Отмена / полный возврат</h2>
        <input className="admin-field" name="reason" minLength={3} maxLength={500} placeholder="Обязательная причина" required />
        <button className="admin-button" style={{ marginTop: 10 }}>Запросить отмену</button>
      </form>

      <h2>Timeline</h2>
      {currentOrder.statusHistory.map((event) => (
        <p key={event.id}>{new Date(event.createdAt).toLocaleString("ru-RU")} · {event.paymentStatus} / {event.fulfillmentStatus}</p>
      ))}
    </section>
  );
}
