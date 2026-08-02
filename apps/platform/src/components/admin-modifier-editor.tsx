"use client";

import { useEffect, useState } from "react";
import { adminMutation } from "./admin-api";

type Product = { id: string; name: string };
type Option = { id: string; name: string; priceDeltaKopecks: number; position: number; isAvailable: boolean };
type Group = {
  id: string;
  name: string;
  selectionMode: "SINGLE" | "MULTIPLE";
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
  position: number;
  isActive: boolean;
  options: Option[];
  products: Array<{ productId: string; position: number; product: Product }>;
};
type Category = { products: Product[] };

async function fetchEditorState(): Promise<{ groups: Group[]; products: Product[] }> {
  const [groupsResponse, catalogResponse] = await Promise.all([
    fetch("/api/admin/modifiers", { cache: "no-store" }),
    fetch("/api/admin/catalog", { cache: "no-store" }),
  ]);
  if (groupsResponse.status === 401 || catalogResponse.status === 401) {
    location.assign("/admin/login");
    return { groups: [], products: [] };
  }
  if (!groupsResponse.ok || !catalogResponse.ok) throw new Error("modifiers_load_failed");
  const categories = await catalogResponse.json() as Category[];
  return { groups: await groupsResponse.json() as Group[], products: categories.flatMap((category) => category.products) };
}

export function AdminModifierEditor() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");

  const load = async () => {
    const state = await fetchEditorState();
    setGroups(state.groups);
    setProducts(state.products);
  };

  useEffect(() => {
    let active = true;
    void fetchEditorState().then((state) => {
      if (!active) return;
      setGroups(state.groups);
      setProducts(state.products);
    }).catch(() => { if (active) setMessage("Не удалось загрузить модификаторы"); });
    return () => { active = false; };
  }, []);

  async function mutate(url: string, method: "POST" | "PATCH", body: unknown, success: string) {
    try {
      await adminMutation(url, method, body);
      setMessage(success);
      await load();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка");
      return false;
    }
  }

  return <section style={{ padding: "30px 0" }}>
    <h1>Модификаторы</h1>
    <p>Группы, варианты и их привязки к товарам. Суммы задаются в целых копейках.</p>
    {message ? <p role="status" style={{ color: "#ff6b00", fontWeight: 700 }}>{message}</p> : null}

    <form className="admin-card settings-grid" onSubmit={(event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      void mutate("/api/admin/modifiers", "POST", {
        operation: "group",
        name: String(data.get("name")),
        selectionMode: String(data.get("selectionMode")),
        required: data.get("required") === "on",
        minSelect: Number(data.get("minSelect")),
        maxSelect: String(data.get("maxSelect") ?? "").trim() ? Number(data.get("maxSelect")) : null,
        position: Number(data.get("position")),
      }, "Группа создана").then((saved) => { if (saved) form.reset(); });
    }}>
      <h2 className="settings-wide">Новая группа</h2>
      <label>Название<input className="admin-field" name="name" required /></label>
      <label>Режим<select className="admin-field" name="selectionMode"><option value="SINGLE">Один вариант</option><option value="MULTIPLE">Несколько</option></select></label>
      <label>Минимум<input className="admin-field" name="minSelect" type="number" min="0" defaultValue="0" required /></label>
      <label>Максимум<input className="admin-field" name="maxSelect" type="number" min="1" /></label>
      <label>Позиция<input className="admin-field" name="position" type="number" min="0" defaultValue="0" required /></label>
      <label><input name="required" type="checkbox" /> Обязательная</label>
      <button className="admin-button">Создать группу</button>
    </form>

    {groups.map((group) => <article className="admin-card" key={group.id}>
      <form className="settings-grid" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void mutate("/api/admin/modifiers", "PATCH", {
          operation: "group",
          id: group.id,
          name: String(data.get("name")),
          required: data.get("required") === "on",
          minSelect: Number(data.get("minSelect")),
          maxSelect: String(data.get("maxSelect") ?? "").trim() ? Number(data.get("maxSelect")) : null,
          isActive: data.get("active") === "on",
        }, "Группа обновлена");
      }}>
        <h2 className="settings-wide">{group.name} · {group.selectionMode}</h2>
        <label>Название<input className="admin-field" name="name" defaultValue={group.name} required /></label>
        <label>Минимум<input className="admin-field" name="minSelect" type="number" min="0" defaultValue={group.minSelect} required /></label>
        <label>Максимум<input className="admin-field" name="maxSelect" type="number" min="1" defaultValue={group.maxSelect ?? ""} /></label>
        <label><input name="required" type="checkbox" defaultChecked={group.required} /> Обязательная</label>
        <label><input name="active" type="checkbox" defaultChecked={group.isActive} /> Активна</label>
        <button className="admin-button">Сохранить группу</button>
      </form>

      <h3>Варианты</h3>
      <div style={{ display: "grid", gap: 8 }}>
        {group.options.map((option) => <form className="settings-grid" key={option.id} onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void mutate("/api/admin/modifiers", "PATCH", {
            operation: "option",
            id: option.id,
            name: String(data.get("name")),
            priceDeltaKopecks: Number(data.get("price")),
            isAvailable: data.get("available") === "on",
          }, "Вариант обновлён");
        }}>
          <label>Название<input className="admin-field" name="name" defaultValue={option.name} required /></label>
          <label>Доплата, коп.<input className="admin-field" name="price" type="number" min="0" defaultValue={option.priceDeltaKopecks} required /></label>
          <label><input name="available" type="checkbox" defaultChecked={option.isAvailable} /> Доступен</label>
          <button className="admin-button">Сохранить</button>
        </form>)}
      </div>
      <form className="settings-grid" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        void mutate("/api/admin/modifiers", "POST", {
          operation: "option",
          groupId: group.id,
          name: String(data.get("name")),
          priceDeltaKopecks: Number(data.get("price")),
          position: Number(data.get("position")),
        }, "Вариант создан").then((saved) => { if (saved) form.reset(); });
      }}>
        <h3 className="settings-wide">Добавить вариант</h3>
        <label>Название<input className="admin-field" name="name" required /></label>
        <label>Доплата, коп.<input className="admin-field" name="price" type="number" min="0" defaultValue="0" required /></label>
        <label>Позиция<input className="admin-field" name="position" type="number" min="0" defaultValue={group.options.length} required /></label>
        <button className="admin-button">Добавить</button>
      </form>

      <details style={{ marginTop: 18 }}>
        <summary>Привязки к товарам ({group.products.length})</summary>
        <div style={{ columns: "240px", marginTop: 12 }}>
          {products.map((product) => {
            const binding = group.products.find((candidate) => candidate.productId === product.id);
            return <label key={product.id} style={{ display: "block", breakInside: "avoid", padding: "5px 0" }}>
              <input type="checkbox" checked={Boolean(binding)} onChange={(event) => void mutate("/api/admin/modifiers", "PATCH", {
                operation: "binding",
                productId: product.id,
                modifierGroupId: group.id,
                enabled: event.currentTarget.checked,
                position: binding?.position ?? group.position,
              }, "Привязка обновлена")} /> {product.name}
            </label>;
          })}
        </div>
      </details>
    </article>)}
  </section>;
}
