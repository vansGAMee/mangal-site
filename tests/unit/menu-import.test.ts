import { describe, expect, it } from "vitest";
import { MenuImportError, parseMenuImport } from "@platform/server/catalog/menu-import";

describe("menu import parsing", () => {
  it("parses quoted CSV and converts decimal rubles to exact kopecks", () => {
    const csv = [
      "category,name,description,price,oldPrice,weight,image,available,sortOrder",
      'Горячее,"Блюдо, фирменное","Строка 1\nСтрока 2",350.45,400,250,/images/product-placeholder.svg,true,7',
    ].join("\n");
    const plan = parseMenuImport("menu.csv", Buffer.from(csv));
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]).toMatchObject({
      category: "Горячее",
      name: "Блюдо, фирменное",
      description: "Строка 1\nСтрока 2",
      priceKopecks: 35_045,
      oldPriceKopecks: 40_000,
      weightGrams: 250,
      slug: "blyudo-firmennoe",
      available: true,
      sortOrder: 7,
    });
  });

  it("parses JSON and blocks unpriced products instead of assigning zero", () => {
    const plan = parseMenuImport("menu.json", Buffer.from(JSON.stringify([{
      category: "Сезонное",
      name: "Цена позже",
      description: null,
      price: null,
      oldPrice: null,
      weight: null,
      image: null,
      available: false,
      sortOrder: 1,
    }])));
    expect(plan.rows[0]?.priceKopecks).toBeNull();
  });

  it("reports the source row and duplicate generated slug", () => {
    const csv = [
      "category,name,description,price,oldPrice,weight,image,available,sortOrder",
      "Основное,Одинаково,,100,,,,true,1",
      "Основное,Одинаково,,120,,,,true,2",
    ].join("\n");
    expect(() => parseMenuImport("menu.csv", Buffer.from(csv))).toThrowError(MenuImportError);
    try {
      parseMenuImport("menu.csv", Buffer.from(csv));
    } catch (error) {
      expect((error as MenuImportError).issues.join(" ")).toContain("Строка 3");
    }
  });

  it("rejects external image hosts and non-discount old prices", () => {
    const header = "category,name,description,price,oldPrice,weight,image,available,sortOrder";
    expect(() => parseMenuImport("menu.csv", Buffer.from(`${header}\nОсновное,Фото,,100,,,https://tracker.example/image.jpg,true,1`))).toThrowError(MenuImportError);
    expect(() => parseMenuImport("menu.csv", Buffer.from(`${header}\nОсновное,Скидка,,100,90,,,true,1`))).toThrowError(MenuImportError);
  });
});
