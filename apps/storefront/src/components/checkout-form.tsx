"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, formatRubles } from "@mangal/design-system";
import type { ApiErrorResponse, PublicCatalogResponse } from "@mangal/contracts";
import { useCart } from "@/store/cart";

type Confirmation = {
  orderPublicId: string;
  paymentStatus: string;
  confirmationType: string | null;
  confirmationUrl: string | null;
  confirmationData: string | null;
};

export function CheckoutForm({ catalog }: { catalog: PublicCatalogResponse }) {
  const items = useCart((state) => state.items);
  const clear = useCart((state) => state.clear);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [fulfillmentType, setFulfillmentType] = useState<"DELIVERY" | "PICKUP">("PICKUP");
  const products = useMemo(() => new Map(catalog.categories.flatMap((category) => category.products).map((product) => [product.id, product])), [catalog]);
  const estimated = items.reduce((sum, line) => {
    const product = products.get(line.productId);
    if (!product) return sum;
    const base = product.pricingType === "FIXED" ? product.basePriceKopecks : product.unitPriceKopecks;
    const delta = product.modifiers.flatMap((group) => group.options).filter((option) => line.modifierOptionIds.includes(option.id)).reduce((value, option) => value + option.priceDeltaKopecks, 0);
    return sum + ((base ?? 0) + delta) * line.quantity;
  }, 0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError("");
    const form = new FormData(event.currentTarget);
    let checkoutId = sessionStorage.getItem("mangal-checkout-id");
    if (!checkoutId) { checkoutId = crypto.randomUUID(); sessionStorage.setItem("mangal-checkout-id", checkoutId); }
    const phone = normalizePhone(String(form.get("phone") ?? ""));
    // Validate phone before sending
    if (!/^\+7\d{10}$/.test(phone)) {
      setError("Введите российский номер телефона в формате +7 927 000 00 00"); setSubmitting(false); return;
    }
    const slotValue = String(form.get("slotStart") ?? "");
    const isPickup = fulfillmentType === "PICKUP";
    // slotStart: если не заполнено или в прошлом — берём +30 минут
    const slotDate = slotValue ? new Date(slotValue) : null;
    const slotIso = (slotDate && slotDate.getTime() > Date.now() + 5 * 60_000)
      ? slotDate.toISOString()
      : new Date(Date.now() + 30 * 60_000).toISOString();
    // zoneId: для PICKUP берём первую зону из каталога или nil UUID (TEST MODE сам найдёт зону в БД)
    const pickupZoneId = catalog.store.deliveryZones[0]?.id ?? "00000000-0000-0000-0000-000000000000";
    const payload = {
      checkoutId,
      items: items.map((item) => ({ ...item })),
      contact: { phone, ...(form.get("email") ? { email: String(form.get("email")) } : {}) },
      delivery: {
        zoneId: isPickup ? pickupZoneId : String(form.get("zoneId") || pickupZoneId),
        city: isPickup ? "Маркс" : String(form.get("city")),
        street: isPickup ? "Самовывоз" : String(form.get("street")),
        house: isPickup ? "1" : String(form.get("house")),
        ...(form.get("apartment") && !isPickup ? { apartment: String(form.get("apartment")) } : {}),
        ...(form.get("entrance") && !isPickup ? { entrance: String(form.get("entrance")) } : {}),
        ...(form.get("floor") && !isPickup ? { floor: String(form.get("floor")) } : {}),
        ...(form.get("intercom") && !isPickup ? { intercom: String(form.get("intercom")) } : {}),
        slotStart: slotIso,
        comment: isPickup ? `[САМОВЫВОЗ] ${form.get("comment") || ""}`.trim() : String(form.get("comment") || ""),
      },
      paymentMethod: String(form.get("paymentMethod")),
      consents: {
        personalData: { accepted: form.get("personalData") === "on", version: "pd-v1" },
        marketing: { accepted: form.get("marketing") === "on", version: "marketing-v1" },
        offer: { accepted: form.get("offer") === "on", version: "offer-v1" },
        terms: { accepted: form.get("terms") === "on", version: "terms-v1" },
      },
    };
    try {
      const apiUrl = process.env.NEXT_PUBLIC_PLATFORM_API_URL || "https://mangal-site-stkl.vercel.app";
      const response = await fetch(`${apiUrl}/api/checkout`, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": "application/json", "X-Request-Id": crypto.randomUUID() },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as Confirmation | ApiErrorResponse;
      if (!response.ok) {
        const code = "error" in body ? body.error.code : "validation";
        setError(errorMessage(code)); return;
      }
      const result = body as Confirmation;
      sessionStorage.removeItem("mangal-checkout-id"); clear(); setConfirmation(result);
      if (result.confirmationType === "REDIRECT" && result.confirmationUrl) location.assign(result.confirmationUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось связаться с сервисом оформления");
    } finally { setSubmitting(false); }
  }

  if (confirmation) {
    const isTest = confirmation.confirmationType === "TEST_MODE";
    return <section className="border border-white/10 p-7">
      {isTest && <p style={{ background: "#f97316", color: "#000", padding: "4px 12px", marginBottom: 16, fontWeight: "bold", display: "inline-block" }}>🧪 ТЕСТ-ЗАКАЗ — без оплаты</p>}
      <p className="eyebrow">{isTest ? "Тестовый заказ создан" : "Заказ создан"}</p>
      <h2 className="display mt-3 text-5xl">{confirmation.orderPublicId}</h2>
      {isTest && <p className="mt-4 text-sm text-[var(--muted)]">Заказ записан в базу данных. Проверьте в <a className="text-[var(--copper)] underline" href="/admin/orders">Админке → Заказы</a>. Статус: {confirmation.paymentStatus}.</p>}
      {confirmation.confirmationType === "QR" && confirmation.confirmationData ? <><p className="mt-5 text-sm text-[var(--muted)]">Откройте ссылку СБП на мобильном устройстве:</p><a className="mt-3 block break-all border border-[var(--copper)] p-4 text-sm" href={confirmation.confirmationData}>Перейти к оплате через СБП</a></> : null}
      {!isTest && <Link href={`/order/${confirmation.orderPublicId}`} className="mt-6 inline-block text-[var(--copper)]">Проверить статус заказа →</Link>}
    </section>;
  }

  if (!items.length) return <div className="border border-white/10 p-8"><h2 className="display text-4xl">Корзина пуста</h2><Link href="/#menu" className="mt-5 inline-block text-[var(--copper)]">Вернуться в меню →</Link></div>;

  return <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_.65fr]">
    <div className="space-y-10">
      <fieldset><legend className="display mb-5 text-3xl">Контакты</legend><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Телефон<input className="field mt-2" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 927 000 00 00" required /></label><label className="text-sm">Email для чека, если нужен<input className="field mt-2" name="email" type="email" autoComplete="email" /></label></div></fieldset>
      <fieldset>
        <legend className="display mb-5 text-3xl">Способ получения</legend>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button type="button" onClick={() => setFulfillmentType("PICKUP")} className={`border p-4 text-center font-medium transition ${fulfillmentType === "PICKUP" ? "border-[var(--ember)] bg-white/5 text-white" : "border-white/10 text-[var(--muted)]"}`}>🚀 Самовывоз</button>
          <button type="button" onClick={() => setFulfillmentType("DELIVERY")} className={`border p-4 text-center font-medium transition ${fulfillmentType === "DELIVERY" ? "border-[var(--ember)] bg-white/5 text-white" : "border-white/10 text-[var(--muted)]"}`}>🚚 Доставка</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {fulfillmentType === "DELIVERY" ? (
            <>
              <label className="text-sm sm:col-span-2">Зона<select className="field mt-2" name="zoneId" required defaultValue=""><option value="" disabled>Выберите зону</option>{catalog.store.deliveryZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {zone.city} · {formatRubles(zone.feeKopecks)}</option>)}</select></label>
              <label className="text-sm">Город<input className="field mt-2" name="city" autoComplete="address-level2" required /></label>
              <label className="text-sm">Улица<input className="field mt-2" name="street" autoComplete="street-address" required /></label>
              <label className="text-sm">Дом<input className="field mt-2" name="house" required /></label>
              <label className="text-sm">Квартира<input className="field mt-2" name="apartment" /></label>
              <label className="text-sm">Подъезд<input className="field mt-2" name="entrance" /></label>
              <label className="text-sm">Этаж<input className="field mt-2" name="floor" /></label>
              <label className="text-sm">Домофон<input className="field mt-2" name="intercom" /></label>
            </>
          ) : (
            <input type="hidden" name="zoneId" value={catalog.store.deliveryZones[0]?.id || ""} />
          )}
          <label className="text-sm sm:col-span-2">{fulfillmentType === "PICKUP" ? "К какому времени приготовить?" : "Время доставки"}<input className="field mt-2" name="slotStart" type="datetime-local" required /></label>
          <label className="text-sm sm:col-span-2">Комментарий<textarea className="field mt-2 min-h-28 resize-y" name="comment" maxLength={500} placeholder={fulfillmentType === "PICKUP" ? "Например: без лука, упаковать покрепче" : "Дополнительные пожелания"} /></label>
        </div>
      </fieldset>
      <fieldset><legend className="display mb-5 text-3xl">Оплата</legend><div className="grid grid-cols-2 gap-3"><label className="border border-white/10 p-4 has-[:checked]:border-[var(--ember)]"><input type="radio" name="paymentMethod" value="CARD" defaultChecked /> <span className="ml-2">Картой</span></label><label className="border border-white/10 p-4 has-[:checked]:border-[var(--ember)]"><input type="radio" name="paymentMethod" value="SBP" /> <span className="ml-2">СБП</span></label></div></fieldset>
      <fieldset className="space-y-4"><legend className="sr-only">Согласия</legend><label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" name="personalData" required={catalog.store.personalDataLegalBasis === "CONSENT"} /> <span>Я ознакомлен(а) с <Link className="underline" href="/legal/privacy">политикой обработки персональных данных</Link>. Чекбокс не предустановлен. {catalog.store.personalDataLegalBasis === "CONTRACT" ? "Основание заказа настроено как исполнение договора; юрист должен подтвердить эту модель." : "Для заказа требуется отдельное согласие."}</span></label><label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" name="offer" required /> <span>Принимаю <Link className="underline" href="/legal/offer">оферту и условия доставки</Link>.</span></label><label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" name="terms" required /> <span>Принимаю <Link className="underline" href="/legal/terms">пользовательское соглашение</Link>.</span></label><label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" name="marketing" /> <span>Хочу получать рекламные SMS. Это необязательно для заказа; отказ также будет сохранён.</span></label></fieldset>
    </div>
    <aside className="h-fit border border-white/10 p-6 lg:sticky lg:top-6"><p className="eyebrow">Ваш заказ</p><div className="mt-5 space-y-4">{items.map((line) => <div key={`${line.productId}:${line.modifierOptionIds.join(",")}`} className="flex justify-between gap-4 border-b border-white/10 pb-4"><span>{products.get(line.productId)?.name ?? "Каталог изменился"} × {line.quantity}{line.unit === "KILOGRAM" ? " кг" : ""}</span></div>)}</div><div className="mt-5 flex justify-between"><span>Предварительно</span><strong className="mono">{formatRubles(estimated)}</strong></div><p className="mt-3 text-xs leading-5 text-[var(--muted)]">Доставка и итог пересчитываются на сервере.</p>{error ? <p role="alert" className="mt-5 border border-[var(--ember)] p-3 text-sm">{error}</p> : null}<Button type="submit" disabled={submitting} className="mt-6 w-full">{submitting ? "Создаём заказ…" : "Перейти к оплате"}</Button></aside>
  </form>;
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) return `+7${digits.slice(1)}`;
  return value.startsWith("+") ? `+${digits}` : `+${digits}`;
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    catalog_changed: "Каталог изменился. Вернитесь в меню и проверьте корзину.", slot_unavailable: "Выбранное время доставки недоступно.", checkout_conflict: "Этот запрос оформления уже использован с другими данными.", consent_required: "Нужно подтвердить обработку персональных данных.", min_order: "Не достигнута минимальная сумма заказа.", rate_limited: "Слишком много попыток. Подождите минуту.", payment_provider_unavailable: "Заказ сохранён, но эквайер не ответил. Статус будет сверен автоматически.", store_not_configured: "Онлайн-оформление пока не запущено: оператор не завершил обязательные настройки.", validation: "Проверьте заполнение формы.",
  };
  return messages[code] ?? "Не удалось оформить заказ.";
}
