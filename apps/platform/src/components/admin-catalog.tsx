"use client";
import { useEffect, useState } from "react";
import { adminMutation, csrfToken } from "./admin-api";

type Product = {
  id: string;
  name: string;
  displayPriceLabel: string;
  basePriceKopecks: number | null;
  unitPriceKopecks: number | null;
  pricingType: string;
  requiresPriceConfirmation: boolean;
  isOrderable: boolean;
  isAvailable: boolean;
  version: number;
  imagePath: string;
};

type Category = { id: string; name: string; products: Product[] };

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
    try {
      // Check if there is an image to upload
      const file = data.get("image") as File;
      if (file && file.size > 0) {
        setMessage("Загрузка изображения...");
        const formData = new FormData();
        formData.append("image", file);
        const token = csrfToken();
        const uploadRes = await fetch(`/api/admin/catalog/products/${product.id}/image`, {
          method: "POST",
          headers: token ? { "X-CSRF-Token": token } : {},
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Image upload failed: " + await uploadRes.text());
      }

      await adminMutation(`/api/admin/catalog/products/${product.id}`, "PATCH", {
        version: product.version,
        displayPriceLabel: String(data.get("label")),
        basePriceKopecks: data.get("price") ? Number(data.get("price")) : null,
        unitPriceKopecks:
          product.pricingType === "PER_KILOGRAM" ? (data.get("price") ? Number(data.get("price")) : null) : null,
        requiresPriceConfirmation: data.get("unconfirmed") === "on",
        isOrderable: data.get("orderable") === "on",
        isAvailable: data.get("available") === "on",
      });
      setMessage("Сохранено");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка");
    }
  }

  async function removeCategory(categoryId: string) {
    if (!confirm("Вы уверены, что хотите удалить эту категорию?")) return;
    setMessage("Удаление категории...");
    try {
      await adminMutation(`/api/admin/categories/${categoryId}`, "DELETE");
      setMessage("Категория удалена");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка при удалении категории");
    }
  }

  async function removeProduct(productId: string) {
    if (!confirm("Вы уверены, что хотите удалить это блюдо?")) return;
    setMessage("Удаление...");
    try {
      await adminMutation(`/api/admin/catalog/products/${productId}`, "DELETE");
      setMessage("Блюдо удалено");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка при удалении");
    }
  }

  async function addProduct(categoryId: string, form: HTMLFormElement) {
    setMessage("Создание...");
    const data = new FormData(form);
    const name = String(data.get("name")).trim();
    const price = Number(data.get("price"));
    const label = String(data.get("label")).trim() || `${Math.round(price / 100)} ₽`;
    try {
      await adminMutation("/api/admin/catalog/products", "POST", {
        categoryId,
        name,
        priceKopecks: price,
        displayPriceLabel: label,
      });
      setMessage("Новое блюдо добавлено!");
      form.reset();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка при создании");
    }
  }

  return (
    <section style={{ padding: "30px 0" }}>
      <h1>Каталог</h1>
      <p>Управление блюдами: добавление новых позиций, изменение цен, фото и удаление ненужных.</p>
      {message ? <p role="status" style={{ color: "#ff6b00", fontWeight: "bold" }}>{message}</p> : null}
      {categories.map((category) => (
        <div key={category.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 38, borderBottom: "1px solid #444", paddingBottom: 8 }}>
            <h2 style={{ margin: 0 }}>{category.name}</h2>
            <button
              type="button"
              onClick={() => void removeCategory(category.id)}
              style={{ background: "transparent", color: "#dc2626", border: "1px solid #dc2626", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
            >
              🗑 Удалить категорию
            </button>
          </div>
          
          {/* Add Product Form */}
          <form
            className="admin-card"
            style={{ background: "#fdf8f5", border: "1px dashed #ff6b00", marginTop: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              void addProduct(category.id, e.currentTarget);
            }}
          >
            <b style={{ color: "#ff6b00" }}>+ Добавить новое блюдо в «{category.name}»</b>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 10 }}>
              <input className="admin-field" name="name" placeholder="Название блюда" required />
              <input className="admin-field" name="price" type="number" min="0" placeholder="Цена в коп. (н-р 25000 = 250₽)" required />
              <input className="admin-field" name="label" placeholder="Подпись (н-р '250 ₽')" />
              <button className="admin-button" style={{ background: "#ff6b00", color: "#fff" }}>+ Создать</button>
            </div>
          </form>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {category.products.map((product) => (
              <form
                key={product.id}
                className="admin-card"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save(product, event.currentTarget);
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                   <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                     {product.imagePath && product.imagePath !== "/images/product-placeholder.svg" && (
                       <img src={product.imagePath} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }} />
                     )}
                     <b>{product.name}</b>
                   </div>
                   <button
                     type="button"
                     onClick={() => void removeProduct(product.id)}
                     style={{ background: "#dc2626", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: "bold" }}
                   >
                     🗑 Удалить
                   </button>
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
                    Цена, коп.
                    <input
                      className="admin-field"
                      name="price"
                      type="number"
                      min="0"
                      defaultValue={product.basePriceKopecks ?? product.unitPriceKopecks ?? ""}
                    />
                  </label>
                  <label>
                    Подпись
                    <input className="admin-field" name="label" defaultValue={product.displayPriceLabel} />
                  </label>
                  <label>
                    Фото товара
                    <input type="file" name="image" accept="image/*" style={{ marginTop: 4, display: "block" }} />
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
