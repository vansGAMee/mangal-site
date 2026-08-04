"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { adminMutation, csrfToken } from "./admin-api";

type Product = {
  id: string;
  categoryId: string;
  name: string;
  compositionText: string | null;
  portionNote: string | null;
  displayPriceLabel: string;
  basePriceKopecks: number | null;
  oldPriceKopecks: number | null;
  unitPriceKopecks: number | null;
  pricingType: string;
  requiresPriceConfirmation: boolean;
  isOrderable: boolean;
  isAvailable: boolean;
  position: number;
  fiscalVatCode: string | null;
  fiscalPaymentSubject: string | null;
  fiscalPaymentMode: string | null;
  fiscalMeasure: string | null;
  version: number;
  imagePath: string;
};

type Category = { id: string; name: string; position: number; isActive: boolean; products: Product[] };

export function AdminCatalog() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState("");

  const load = () =>
    fetch("/api/admin/catalog", { cache: "no-store" }).then(async (r) => {
      if (r.status === 401) location.assign("/admin/login");
      else setCategories((await r.json()) as Category[]);
    });

  useEffect(() => {
    void load();
  }, []);

  async function save(product: Product, form: HTMLFormElement) {
    setMessage("Сохранение...");
    const data = new FormData(form);
    const nullableText = (name: string) => String(data.get(name) ?? "").trim() || null;
    try {
      const updated = await adminMutation(`/api/admin/catalog/products/${product.id}`, "PATCH", {
        version: product.version,
        categoryId: String(data.get("categoryId")),
        name: String(data.get("name")),
        compositionText: nullableText("compositionText"),
        portionNote: nullableText("portionNote"),
        displayPriceLabel: String(data.get("label")),
        basePriceKopecks:
          product.pricingType === "FIXED" ? (data.get("price") ? Number(data.get("price")) : null) : null,
        oldPriceKopecks: data.get("oldPrice") ? Number(data.get("oldPrice")) : null,
        unitPriceKopecks:
          product.pricingType === "PER_KILOGRAM" ? (data.get("price") ? Number(data.get("price")) : null) : null,
        requiresPriceConfirmation: data.get("unconfirmed") === "on",
        isOrderable: data.get("orderable") === "on",
        isAvailable: data.get("available") === "on",
        position: Number(data.get("position")),
        fiscalVatCode: nullableText("fiscalVatCode"),
        fiscalPaymentSubject: nullableText("fiscalPaymentSubject"),
        fiscalPaymentMode: nullableText("fiscalPaymentMode"),
        fiscalMeasure: nullableText("fiscalMeasure"),
      }) as Product;
      const file = data.get("image");
      if (file instanceof File && file.size > 0) {
        setMessage("Загрузка изображения...");
        const formData = new FormData();
        formData.append("image", file);
        formData.append("version", String(updated.version));
        const token = csrfToken();
        const uploadRes = await fetch(`/api/admin/catalog/products/${product.id}/image`, {
          method: "POST",
          headers: token ? { "X-CSRF-Token": token } : {},
          body: formData,
        });
        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({ error: "upload_failed" })) as { error?: string };
          throw new Error(body.error ?? "upload_failed");
        }
      }
      setMessage("Сохранено");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка");
    }
  }

  async function createCategory(form: HTMLFormElement) {
    const data = new FormData(form);
    try {
      await adminMutation("/api/admin/categories", "POST", {
        name: String(data.get("name")),
        position: Number(data.get("position")),
      });
      form.reset();
      setMessage("Категория создана");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка");
    }
  }

  async function saveCategory(category: Category, form: HTMLFormElement) {
    const data = new FormData(form);
    try {
      await adminMutation(`/api/admin/categories/${category.id}`, "PATCH", {
        name: String(data.get("name")),
        position: Number(data.get("position")),
        isActive: data.get("active") === "on",
      });
      setMessage("Категория обновлена");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка");
    }
  }

  async function createProduct(form: HTMLFormElement) {
    const data = new FormData(form);
    const optionalText = (name: string) => String(data.get(name) ?? "").trim() || null;
    const optionalNumber = (name: string) => String(data.get(name) ?? "").trim() ? Number(data.get(name)) : null;
    try {
      await adminMutation("/api/admin/catalog/products", "POST", {
        categoryId: String(data.get("categoryId")),
        name: String(data.get("name")),
        compositionText: optionalText("compositionText"),
        portionNote: optionalText("portionNote"),
        pricingType: String(data.get("pricingType")),
        saleUnit: String(data.get("saleUnit")),
        priceKopecks: optionalNumber("priceKopecks"),
        oldPriceKopecks: optionalNumber("oldPriceKopecks"),
        weightGrams: optionalNumber("weightGrams"),
        position: Number(data.get("position")),
      });
      form.reset();
      setMessage("Товар создан. Перед production-запуском заполните его фискальные атрибуты.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка");
    }
  }

  return (
    <section style={{ padding: "30px 0" }}>
      <h1>Каталог</h1>
      <p>
        Цены — целые копейки. Снятие «цена уточняется» возможно только вместе с подтверждённой ценой и orderable-флагом.
      </p>
      {message ? <p role="status" style={{ color: "#ff6b00", fontWeight: "bold" }}>{message}</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <form className="admin-card" onSubmit={(event) => { event.preventDefault(); void createCategory(event.currentTarget); }}>
          <h2>Новая категория</h2>
          <label>Название<input className="admin-field" name="name" required maxLength={120} /></label>
          <label>Позиция<input className="admin-field" name="position" type="number" min="0" defaultValue="0" required /></label>
          <button className="admin-button" style={{ marginTop: 12 }}>Создать категорию</button>
        </form>
        <form className="admin-card" onSubmit={(event) => { event.preventDefault(); void createProduct(event.currentTarget); }}>
          <h2>Новый товар</h2>
          <label>Категория
            <select className="admin-field" name="categoryId" required defaultValue="">
              <option value="" disabled>Выберите категорию</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>Название<input className="admin-field" name="name" required maxLength={160} /></label>
          <label>Состав<textarea className="admin-field" name="compositionText" maxLength={1_000} /></label>
          <label>Порция<input className="admin-field" name="portionNote" maxLength={240} placeholder="Например: порция 300 г" /></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label>Тип цены
              <select className="admin-field" name="pricingType" defaultValue="FIXED">
                <option value="FIXED">Фиксированная</option><option value="PER_KILOGRAM">За килограмм</option>
              </select>
            </label>
            <label>Единица
              <select className="admin-field" name="saleUnit" defaultValue="PIECE">
                <option value="PIECE">Штука</option><option value="PORTION">Порция</option><option value="KILOGRAM">Килограмм</option>
              </select>
            </label>
          </div>
          <label>Цена, коп. (пусто = уточняется)<input className="admin-field" name="priceKopecks" type="number" min="1" /></label>
          <label>Старая цена, коп.<input className="admin-field" name="oldPriceKopecks" type="number" min="1" /></label>
          <label>Подтверждённый вес, г<input className="admin-field" name="weightGrams" type="number" min="1" /></label>
          <label>Позиция<input className="admin-field" name="position" type="number" min="0" defaultValue="0" required /></label>
          <button className="admin-button" style={{ marginTop: 12 }}>Создать товар</button>
        </form>
      </div>
      {categories.map((category) => (
        <div key={category.id}>
          <form
            className="admin-card"
            style={{ marginTop: 38, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, alignItems: "end" }}
            onSubmit={(event) => { event.preventDefault(); void saveCategory(category, event.currentTarget); }}
          >
            <label>Категория<input className="admin-field" name="name" defaultValue={category.name} required /></label>
            <label>Позиция<input className="admin-field" name="position" type="number" min="0" defaultValue={category.position} required /></label>
            <label><input name="active" type="checkbox" defaultChecked={category.isActive} /> Активна</label>
            <button className="admin-button">Сохранить</button>
          </form>
          <div style={{ display: "grid", gap: 10 }}>
            {category.products.map((product) => (
              <form
                key={product.id}
                className="admin-card"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save(product, event.currentTarget);
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                   {product.imagePath && product.imagePath !== "/images/product-placeholder.svg" && (
                     <Image src={product.imagePath} alt="" width={40} height={40} unoptimized style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }} />
                   )}
                   <b>{product.name}</b>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <label>
                    Категория
                    <select className="admin-field" name="categoryId" defaultValue={product.categoryId}>
                      {categories.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Название
                    <input className="admin-field" name="name" defaultValue={product.name} required maxLength={160} />
                  </label>
                  <label>
                    Цена, коп.
                    <input
                      className="admin-field"
                      name="price"
                      type="number"
                      min="1"
                      defaultValue={product.basePriceKopecks ?? product.unitPriceKopecks ?? ""}
                    />
                  </label>
                  <label>
                    Старая цена, коп.
                    <input className="admin-field" name="oldPrice" type="number" min="1" defaultValue={product.oldPriceKopecks ?? ""} />
                  </label>
                  <label>
                    Подпись
                    <input className="admin-field" name="label" defaultValue={product.displayPriceLabel} />
                  </label>
                  <label>
                    Состав
                    <textarea className="admin-field" name="compositionText" defaultValue={product.compositionText ?? ""} maxLength={1_000} />
                  </label>
                  <label>
                    Порция
                    <input className="admin-field" name="portionNote" defaultValue={product.portionNote ?? ""} maxLength={240} />
                  </label>
                  <label>
                    Позиция
                    <input className="admin-field" name="position" type="number" min="0" defaultValue={product.position} required />
                  </label>
                  <label>
                    VAT-код
                    <input className="admin-field" name="fiscalVatCode" defaultValue={product.fiscalVatCode ?? ""} />
                  </label>
                  <label>
                    Предмет расчёта
                    <input className="admin-field" name="fiscalPaymentSubject" defaultValue={product.fiscalPaymentSubject ?? ""} />
                  </label>
                  <label>
                    Способ расчёта
                    <input className="admin-field" name="fiscalPaymentMode" defaultValue={product.fiscalPaymentMode ?? ""} />
                  </label>
                  <label>
                    Единица в чеке
                    <input className="admin-field" name="fiscalMeasure" defaultValue={product.fiscalMeasure ?? ""} />
                  </label>
                  <label>
                    Фото товара
                    <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" style={{ marginTop: 4, display: "block" }} />
                  </label>
                  <label>
                    <input name="available" type="checkbox" defaultChecked={product.isAvailable} /> Доступен
                  </label>
                  <label>
                    <input name="orderable" type="checkbox" defaultChecked={product.isOrderable} /> Заказываемый
                  </label>
                  <label>
                    <input name="unconfirmed" type="checkbox" defaultChecked={product.requiresPriceConfirmation} /> Цена
                    уточняется
                  </label>
                  <button className="admin-button">Сохранить v{product.version}</button>
                </div>
              </form>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
