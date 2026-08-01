"use client";

import { useEffect, useState } from "react";
import { adminMutation } from "./admin-api";

type Route = { method: "CARD" | "SBP"; provider: "YOOKASSA" | "TBANK"; isActive: boolean };
type Settings = {
  store: { version: number; leadTimeMinutes: number; minimumOrderKopecks: number | null; legalBasis: "CONTRACT" | "CONSENT"; taxSystemCode: string | null };
  zones: Array<{ id: string; name: string; city: string; feeKopecks: number; freeThresholdKopecks: number | null; minOrderKopecks: number | null; isActive: boolean; version: number }>;
  hours: unknown[];
  routing: Route[];
};

export function AdminSettings() {
  const [data, setData] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const load = () => fetch("/api/admin/settings", { cache: "no-store" }).then(async (response) => setData(await response.json() as Settings));
  useEffect(() => { void load(); }, []);
  if (!data) return <p>Загрузка…</p>;

  async function store(form: HTMLFormElement) {
    const fields = new FormData(form);
    try {
      await adminMutation("/api/admin/settings", "PATCH", { operation: "store", version: data!.store.version, leadTimeMinutes: Number(fields.get("lead")), minimumOrderKopecks: fields.get("minimum") ? Number(fields.get("minimum")) : null, legalBasis: fields.get("basis"), taxSystemCode: fields.get("tax") || null });
      setMessage("Настройки сохранены"); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка"); }
  }
  async function zone(form: HTMLFormElement) {
    const fields = new FormData(form);
    try {
      await adminMutation("/api/admin/settings", "PATCH", { operation: "zone", name: fields.get("name"), city: fields.get("city"), feeKopecks: Number(fields.get("fee")), freeThresholdKopecks: fields.get("free") ? Number(fields.get("free")) : null, minOrderKopecks: fields.get("minimum") ? Number(fields.get("minimum")) : null, isActive: true });
      setMessage("Зона добавлена"); form.reset(); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка"); }
  }
  async function routing(form: HTMLFormElement) {
    const fields = new FormData(form);
    try {
      const reauth = await adminMutation("/api/admin/reauth", "POST", { password: fields.get("password"), totpCode: fields.get("totp") }) as { nonce: string };
      await adminMutation("/api/admin/payment-routing", "POST", { nonce: reauth.nonce, routes: [
        { method: "CARD", provider: fields.get("card"), isActive: true },
        { method: "SBP", provider: fields.get("sbp"), isActive: true },
      ] });
      setMessage("Payment routing изменён; существующие попытки сохранили исходного провайдера"); form.reset(); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка"); }
  }
  const current = (method: "CARD" | "SBP") => data.routing.find((route) => route.method === method)?.provider ?? "YOOKASSA";
  return <section style={{ padding: "30px 0" }}>
    <h1>Настройки</h1>{message ? <p role="status">{message}</p> : null}
    <form className="admin-card" onSubmit={(event) => { event.preventDefault(); void store(event.currentTarget); }}><h2>Магазин</h2><div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}><label>Lead time<input className="admin-field" name="lead" type="number" defaultValue={data.store.leadTimeMinutes} /></label><label>Минимум, коп.<input className="admin-field" name="minimum" type="number" defaultValue={data.store.minimumOrderKopecks ?? ""} /></label><label>Основание<select className="admin-field" name="basis" defaultValue={data.store.legalBasis}><option>CONTRACT</option><option>CONSENT</option></select></label><label>СНО<input className="admin-field" name="tax" defaultValue={data.store.taxSystemCode ?? ""} /></label><button className="admin-button">Сохранить v{data.store.version}</button></div></form>
    <form className="admin-card" style={{ marginTop: 18 }} onSubmit={(event) => { event.preventDefault(); void zone(event.currentTarget); }}><h2>Добавить зону доставки</h2><div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}><label>Название<input className="admin-field" name="name" required /></label><label>Город<input className="admin-field" name="city" required /></label><label>Стоимость, коп.<input className="admin-field" name="fee" type="number" min="0" required /></label><label>Бесплатно от<input className="admin-field" name="free" type="number" min="0" /></label><label>Минимум<input className="admin-field" name="minimum" type="number" min="0" /></label><button className="admin-button">Добавить</button></div></form>
    <h2>Зоны</h2>{data.zones.map((deliveryZone) => <div className="admin-card" key={deliveryZone.id}>{deliveryZone.name} · {deliveryZone.city} · {deliveryZone.feeKopecks} коп. · v{deliveryZone.version}</div>)}
    <p>Часы работы настраиваются тем же защищённым endpoint по каждому weekday; production gate требует семь записей.</p>
    <form className="admin-card" onSubmit={(event) => { event.preventDefault(); void routing(event.currentTarget); }}><h2>Payment routing · повторная аутентификация</h2><div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}><label>CARD<select className="admin-field" name="card" defaultValue={current("CARD")}><option>YOOKASSA</option><option>TBANK</option></select></label><label>SBP<select className="admin-field" name="sbp" defaultValue={current("SBP")}><option>YOOKASSA</option><option>TBANK</option></select></label><label>Пароль<input className="admin-field" name="password" type="password" required /></label><label>TOTP<input className="admin-field" name="totp" inputMode="numeric" pattern="\d{6}" required /></label><button className="admin-button">Изменить routing</button></div></form>
  </section>;
}
