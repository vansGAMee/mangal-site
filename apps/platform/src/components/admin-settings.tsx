"use client";

import type { RestaurantProfileInput } from "@mangal/contracts";
import { useCallback, useEffect, useState } from "react";
import { adminMutation, csrfToken } from "./admin-api";

type Profile = RestaurantProfileInput & { version: number };
type Route = { method: "CARD" | "SBP"; provider: "YOOKASSA" | "TBANK"; isActive: boolean };
type Store = {
  version: number;
  leadTimeMinutes: number;
  minimumOrderKopecks: number | null;
  legalBasis: "CONTRACT" | "CONSENT";
  taxSystemCode: string | null;
};
type Zone = {
  id: string;
  name: string;
  city: string;
  feeKopecks: number;
  freeThresholdKopecks: number | null;
  minOrderKopecks: number | null;
  isActive: boolean;
  version: number;
};
type Hours = {
  weekday: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  slotLength: number;
  capacity: number | null;
};
type Settings = { profile: Profile | null; store: Store | null; zones: Zone[]; hours: Hours[]; routing: Route[] };

const weekdays = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

export function AdminSettings() {
  const [data, setData] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/settings", { cache: "no-store" });
    if (response.status === 401) return location.assign("/admin/login");
    if (!response.ok) throw new Error("settings_load_failed");
    setData(await response.json() as Settings);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load().catch(() => setMessage("Не удалось загрузить настройки")));
  }, [load]);
  if (!data) return <p>Загрузка…</p>;
  if (!data.profile || !data.store) return <p role="alert">Профиль заведения не создан. Запустите `npm run create-client`.</p>;

  async function saveProfile(form: HTMLFormElement) {
    const fields = new FormData(form);
    try {
      setMessage("Сохраняем профиль…");
      const profile = profileFromForm(fields, data!.profile!);
      let updated = await adminMutation("/api/admin/settings", "PATCH", {
        operation: "profile",
        version: data!.profile!.version,
        profile,
      }) as Profile;
      for (const kind of ["logo", "favicon", "hero"] as const) {
        const file = fields.get(`${kind}File`);
        if (!(file instanceof File) || file.size === 0) continue;
        setMessage(`Загружаем ${kind}…`);
        updated = { ...updated, version: await uploadProfileMedia(kind, file, updated.version) };
      }
      setMessage("Профиль сохранён");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сохранения профиля");
    }
  }

  async function saveStore(form: HTMLFormElement) {
    const fields = new FormData(form);
    try {
      await adminMutation("/api/admin/settings", "PATCH", {
        operation: "store",
        version: data!.store!.version,
        leadTimeMinutes: Number(fields.get("leadTimeMinutes")),
        minimumOrderKopecks: optionalNumber(fields.get("minimumOrderKopecks")),
        legalBasis: fields.get("legalBasis"),
        taxSystemCode: nullableString(fields.get("taxSystemCode")),
      });
      setMessage("Операционные настройки сохранены");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка"); }
  }

  async function saveZone(form: HTMLFormElement, zone?: Zone) {
    const fields = new FormData(form);
    try {
      await adminMutation("/api/admin/settings", "PATCH", {
        operation: "zone",
        ...(zone ? { id: zone.id, version: zone.version } : {}),
        name: fields.get("name"),
        city: fields.get("city"),
        feeKopecks: Number(fields.get("feeKopecks")),
        freeThresholdKopecks: optionalNumber(fields.get("freeThresholdKopecks")),
        minOrderKopecks: optionalNumber(fields.get("minOrderKopecks")),
        isActive: fields.get("isActive") === "on",
      });
      setMessage(zone ? "Зона обновлена" : "Зона добавлена");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка"); }
  }

  async function saveHours(form: HTMLFormElement, weekday: number) {
    const fields = new FormData(form);
    const isClosed = fields.get("isClosed") === "on";
    try {
      await adminMutation("/api/admin/settings", "PATCH", {
        operation: "hours",
        weekday,
        opensAt: isClosed ? null : nullableString(fields.get("opensAt")),
        closesAt: isClosed ? null : nullableString(fields.get("closesAt")),
        isClosed,
        slotLength: Number(fields.get("slotLength")),
        capacity: optionalNumber(fields.get("capacity")),
      });
      setMessage(`${weekdays[weekday]}: часы сохранены`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка"); }
  }

  async function saveRouting(form: HTMLFormElement) {
    const fields = new FormData(form);
    try {
      const reauth = await adminMutation("/api/admin/reauth", "POST", {
        password: fields.get("password"),
        totpCode: fields.get("totp"),
      }) as { nonce: string };
      await adminMutation("/api/admin/payment-routing", "POST", {
        nonce: reauth.nonce,
        routes: [
          { method: "CARD", provider: fields.get("card"), isActive: fields.get("cardActive") === "on" },
          { method: "SBP", provider: fields.get("sbp"), isActive: fields.get("sbpActive") === "on" },
        ],
      });
      setMessage("Маршрутизация оплаты изменена; существующие попытки сохранили провайдера");
      form.reset();
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка"); }
  }

  const profile = data.profile;
  const store = data.store;
  const route = (method: "CARD" | "SBP") => data.routing.find((item) => item.method === method);

  return (
    <section style={{ padding: "30px 0" }}>
      <h1>Настройки заведения</h1>
      <p>Изменения применяются к одному заведению в этом развёртывании. Секреты и банковские ключи здесь не показываются.</p>
      {message ? <p role="status">{message}</p> : null}

      <form className="admin-card" onSubmit={(event) => { event.preventDefault(); void saveProfile(event.currentTarget); }}>
        <h2>Бренд и контакты</h2>
        <div className="settings-grid">
          <TextField name="slug" label="Slug" defaultValue={profile.slug} required />
          <TextField name="name" label="Название" defaultValue={profile.name} required />
          <label className="settings-wide">Описание<textarea className="admin-field" name="description" defaultValue={profile.description ?? ""} maxLength={1000} /></label>
          <TextField name="phoneDisplay" label="Телефон, как показывать" defaultValue={profile.phoneDisplay ?? ""} />
          <TextField name="phoneHref" label="Телефон для tel:, +7…" defaultValue={profile.phoneHref ?? ""} />
          <TextField name="email" label="Публичный email" type="email" defaultValue={profile.email ?? ""} />
          <TextField name="address" label="Адрес" defaultValue={profile.address ?? ""} />
          <TextField name="latitude" label="Широта" type="number" step="any" defaultValue={profile.latitude ?? ""} />
          <TextField name="longitude" label="Долгота" type="number" step="any" defaultValue={profile.longitude ?? ""} />
          <TextField name="vkUrl" label="VK URL" type="url" defaultValue={profile.vkUrl ?? ""} />
          <TextField name="telegramUrl" label="Telegram URL" type="url" defaultValue={profile.telegramUrl ?? ""} />
          <TextField name="whatsappUrl" label="WhatsApp URL" type="url" defaultValue={profile.whatsappUrl ?? ""} />
          <TextField name="currency" label="Валюта" defaultValue={profile.currency} required />
          <TextField name="timezone" label="Часовой пояс" defaultValue={profile.timezone} required />
        </div>

        <h2>Тема и медиа</h2>
        <div className="settings-grid">
          <label>Тема<select className="admin-field" name="theme" defaultValue={profile.theme}><option value="MANGAL_DARK">mangal-dark</option><option value="CAFE_LIGHT">cafe-light</option><option value="SUSHI_MINIMAL">sushi-minimal</option></select></label>
          <TextField name="primaryColor" label="Основной цвет" type="color" defaultValue={profile.primaryColor} required />
          <TextField name="secondaryColor" label="Дополнительный цвет" type="color" defaultValue={profile.secondaryColor} required />
          <TextField name="backgroundColor" label="Фон" type="color" defaultValue={profile.backgroundColor} required />
          <TextField name="foregroundColor" label="Текст" type="color" defaultValue={profile.foregroundColor} required />
          <FileField name="logoFile" label="Логотип" />
          <FileField name="faviconFile" label="Favicon" />
          <FileField name="heroFile" label="Обложка" />
        </div>

        <h2>Получение и SEO</h2>
        <div className="settings-grid">
          <label><input name="deliveryEnabled" type="checkbox" defaultChecked={profile.deliveryEnabled} /> Доставка включена</label>
          <label><input name="pickupEnabled" type="checkbox" defaultChecked={profile.pickupEnabled} /> Самовывоз включён</label>
          <TextField name="pickupLabel" label="Подпись самовывоза" defaultValue={profile.pickupLabel ?? ""} />
          <TextField name="seoTitle" label="SEO title" defaultValue={profile.seoTitle} required />
          <label className="settings-wide">SEO description<textarea className="admin-field" name="seoDescription" defaultValue={profile.seoDescription} required maxLength={320} /></label>
          <TextField name="privacyPolicyPath" label="Путь политики ПД" defaultValue={profile.privacyPolicyPath} required />
        </div>

        <h2>Реквизиты</h2>
        <p>Поля остаются пустыми до подтверждения оператором. Сохранение не означает юридическую проверку.</p>
        <div className="settings-grid">
          <TextField name="legalName" label="Юридическое наименование" defaultValue={profile.legalName ?? ""} />
          <TextField name="legalInn" label="ИНН" inputMode="numeric" defaultValue={profile.legalInn ?? ""} />
          <TextField name="legalRegistrationNo" label="ОГРН / ОГРНИП" inputMode="numeric" defaultValue={profile.legalRegistrationNo ?? ""} />
          <TextField name="legalAddress" label="Юридический адрес" defaultValue={profile.legalAddress ?? ""} />
        </div>
        <button className="admin-button">Сохранить профиль v{profile.version}</button>
      </form>

      <form className="admin-card" onSubmit={(event) => { event.preventDefault(); void saveStore(event.currentTarget); }}>
        <h2>Операционные и фискальные настройки</h2>
        <div className="settings-grid">
          <TextField name="leadTimeMinutes" label="Базовое время, минут" type="number" min="1" defaultValue={store.leadTimeMinutes} required />
          <TextField name="minimumOrderKopecks" label="Минимум, коп." type="number" min="0" defaultValue={store.minimumOrderKopecks ?? ""} />
          <label>Основание ПД<select className="admin-field" name="legalBasis" defaultValue={store.legalBasis}><option>CONTRACT</option><option>CONSENT</option></select></label>
          <TextField name="taxSystemCode" label="СНО (после подтверждения)" defaultValue={store.taxSystemCode ?? ""} />
        </div>
        <button className="admin-button">Сохранить v{store.version}</button>
      </form>

      <h2>Зоны доставки</h2>
      {data.zones.map((zone) => <ZoneForm key={zone.id} zone={zone} onSave={saveZone} />)}
      <ZoneForm onSave={saveZone} />

      <h2>Часы работы</h2>
      <div className="settings-list">
        {weekdays.map((label, weekday) => {
          const value = data.hours.find((item) => item.weekday === weekday);
          return <form key={weekday} className="admin-card" onSubmit={(event) => { event.preventDefault(); void saveHours(event.currentTarget, weekday); }}>
            <h3>{label}</h3>
            <div className="settings-grid">
              <TextField name="opensAt" label="Открытие" type="time" defaultValue={value?.opensAt ?? ""} />
              <TextField name="closesAt" label="Закрытие" type="time" defaultValue={value?.closesAt ?? ""} />
              <TextField name="slotLength" label="Длина слота, минут" type="number" min="1" defaultValue={value?.slotLength ?? ""} required />
              <TextField name="capacity" label="Вместимость слота" type="number" min="1" defaultValue={value?.capacity ?? ""} />
              <label><input name="isClosed" type="checkbox" defaultChecked={value?.isClosed ?? false} /> Выходной</label>
            </div>
            <button className="admin-button">Сохранить</button>
          </form>;
        })}
      </div>

      <form className="admin-card" onSubmit={(event) => { event.preventDefault(); void saveRouting(event.currentTarget); }}>
        <h2>Маршрутизация оплаты · повторная аутентификация</h2>
        <div className="settings-grid">
          <label>CARD<select className="admin-field" name="card" defaultValue={route("CARD")?.provider ?? "YOOKASSA"}><option>YOOKASSA</option><option>TBANK</option></select></label>
          <label><input name="cardActive" type="checkbox" defaultChecked={route("CARD")?.isActive ?? false} /> CARD активен</label>
          <label>SBP<select className="admin-field" name="sbp" defaultValue={route("SBP")?.provider ?? "YOOKASSA"}><option>YOOKASSA</option><option>TBANK</option></select></label>
          <label><input name="sbpActive" type="checkbox" defaultChecked={route("SBP")?.isActive ?? false} /> SBP активен</label>
          <TextField name="password" label="Пароль" type="password" autoComplete="current-password" required />
          <TextField name="totp" label="TOTP" inputMode="numeric" pattern="\d{6}" required />
        </div>
        <button className="admin-button">Изменить routing</button>
      </form>
    </section>
  );
}

function profileFromForm(fields: FormData, current: Profile): RestaurantProfileInput {
  return {
    slug: String(fields.get("slug") ?? ""),
    name: String(fields.get("name") ?? ""),
    description: nullableString(fields.get("description")),
    logoPath: current.logoPath,
    faviconPath: current.faviconPath,
    heroImagePath: current.heroImagePath,
    theme: String(fields.get("theme")) as RestaurantProfileInput["theme"],
    primaryColor: String(fields.get("primaryColor") ?? ""),
    secondaryColor: String(fields.get("secondaryColor") ?? ""),
    backgroundColor: String(fields.get("backgroundColor") ?? ""),
    foregroundColor: String(fields.get("foregroundColor") ?? ""),
    phoneDisplay: nullableString(fields.get("phoneDisplay")),
    phoneHref: nullableString(fields.get("phoneHref")),
    email: nullableString(fields.get("email")),
    address: nullableString(fields.get("address")),
    latitude: optionalNumber(fields.get("latitude")),
    longitude: optionalNumber(fields.get("longitude")),
    vkUrl: nullableString(fields.get("vkUrl")),
    telegramUrl: nullableString(fields.get("telegramUrl")),
    whatsappUrl: nullableString(fields.get("whatsappUrl")),
    currency: String(fields.get("currency") ?? "RUB").toUpperCase(),
    timezone: String(fields.get("timezone") ?? ""),
    seoTitle: String(fields.get("seoTitle") ?? ""),
    seoDescription: String(fields.get("seoDescription") ?? ""),
    legalName: nullableString(fields.get("legalName")),
    legalInn: nullableString(fields.get("legalInn")),
    legalRegistrationNo: nullableString(fields.get("legalRegistrationNo")),
    legalAddress: nullableString(fields.get("legalAddress")),
    privacyPolicyPath: String(fields.get("privacyPolicyPath") ?? ""),
    deliveryEnabled: fields.get("deliveryEnabled") === "on",
    pickupEnabled: fields.get("pickupEnabled") === "on",
    pickupLabel: nullableString(fields.get("pickupLabel")),
  };
}

async function uploadProfileMedia(kind: "logo" | "favicon" | "hero", file: File, version: number): Promise<number> {
  const body = new FormData();
  body.append("kind", kind);
  body.append("version", String(version));
  body.append("image", file);
  const token = csrfToken();
  const response = await fetch("/api/admin/settings/media", {
    method: "POST",
    headers: token ? { "X-CSRF-Token": token } : {},
    body,
  });
  const result = await response.json().catch(() => ({ error: "upload_failed" })) as { version?: number; error?: string };
  if (!response.ok || !result.version) throw new Error(result.error ?? "upload_failed");
  return result.version;
}

function ZoneForm({ zone, onSave }: { zone?: Zone; onSave: (form: HTMLFormElement, zone?: Zone) => Promise<void> }) {
  return <form className="admin-card" onSubmit={(event) => { event.preventDefault(); void onSave(event.currentTarget, zone); }}>
    <h3>{zone ? zone.name : "Добавить зону"}</h3>
    <div className="settings-grid">
      <TextField name="name" label="Название" defaultValue={zone?.name ?? ""} required />
      <TextField name="city" label="Город" defaultValue={zone?.city ?? ""} required />
      <TextField name="feeKopecks" label="Стоимость, коп." type="number" min="0" defaultValue={zone?.feeKopecks ?? ""} required />
      <TextField name="freeThresholdKopecks" label="Бесплатно от, коп." type="number" min="0" defaultValue={zone?.freeThresholdKopecks ?? ""} />
      <TextField name="minOrderKopecks" label="Минимум, коп." type="number" min="0" defaultValue={zone?.minOrderKopecks ?? ""} />
      <label><input name="isActive" type="checkbox" defaultChecked={zone?.isActive ?? true} /> Активна</label>
    </div>
    <button className="admin-button">{zone ? `Сохранить v${zone.version}` : "Добавить"}</button>
  </form>;
}

function TextField({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label>{label}<input className="admin-field" {...props} /></label>;
}

function FileField({ name, label }: { name: string; label: string }) {
  return <label>{label}<input className="admin-field" name={name} type="file" accept="image/jpeg,image/png,image/webp,image/avif" /></label>;
}

function nullableString(value: FormDataEntryValue | null): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? Number(normalized) : null;
}
