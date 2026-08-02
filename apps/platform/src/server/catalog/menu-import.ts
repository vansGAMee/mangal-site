import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "../../../../../generated/prisma/client";

export type MenuImportRow = {
  rowNumber: number;
  category: string;
  categorySlug: string;
  name: string;
  slug: string;
  description: string | null;
  priceKopecks: number | null;
  oldPriceKopecks: number | null;
  weightGrams: number | null;
  image: string | null;
  available: boolean;
  sortOrder: number;
};

export type MenuImportPlan = {
  sourceName: string;
  sourceSha256: string;
  format: "CSV" | "JSON";
  rows: MenuImportRow[];
};

export type MenuImportResult = {
  sourceSha256: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  dryRun: boolean;
};

export class MenuImportError extends Error {
  constructor(
    readonly code: "invalid_format" | "validation" | "duplicate_import",
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
  }
}

const RawRowSchema = z.object({
  category: z.union([z.string(), z.number()]),
  name: z.union([z.string(), z.number()]),
  description: z.union([z.string(), z.number(), z.null()]).optional(),
  price: z.union([z.string(), z.number(), z.null()]).optional(),
  oldPrice: z.union([z.string(), z.number(), z.null()]).optional(),
  weight: z.union([z.string(), z.number(), z.null()]).optional(),
  image: z.union([z.string(), z.null()]).optional(),
  available: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  sortOrder: z.union([z.string(), z.number(), z.null()]).optional(),
}).strict();

const expectedColumns = [
  "category",
  "name",
  "description",
  "price",
  "oldPrice",
  "weight",
  "image",
  "available",
  "sortOrder",
] as const;

export function parseMenuImport(sourceName: string, source: Buffer): MenuImportPlan {
  const lowerName = sourceName.toLowerCase();
  const format = lowerName.endsWith(".csv") ? "CSV" : lowerName.endsWith(".json") ? "JSON" : null;
  if (!format) throw new MenuImportError("invalid_format", "Поддерживаются только CSV и JSON");
  const text = source.toString("utf8").replace(/^\uFEFF/, "");
  const rawRows = format === "CSV" ? csvObjects(text) : jsonObjects(text);
  const issues: string[] = [];
  const rows: MenuImportRow[] = [];
  const slugs = new Map<string, number>();

  rawRows.forEach((raw, index) => {
    const rowNumber = format === "CSV" ? index + 2 : index + 1;
    const parsed = RawRowSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push(`Строка ${rowNumber}: ${z.prettifyError(parsed.error).replace(/\n/g, " ")}`);
      return;
    }
    try {
      const category = requiredText(parsed.data.category, "category");
      const name = requiredText(parsed.data.name, "name");
      const slug = slugify(name);
      const duplicateAt = slugs.get(slug);
      if (duplicateAt !== undefined) {
        throw new Error(`slug ${slug} уже встречался в строке ${duplicateAt}`);
      }
      slugs.set(slug, rowNumber);
      const priceKopecks = optionalRubles(parsed.data.price, "price");
      const oldPriceKopecks = optionalRubles(parsed.data.oldPrice, "oldPrice");
      if (oldPriceKopecks !== null && priceKopecks === null) {
        throw new Error("oldPrice нельзя указать без price");
      }
      if (oldPriceKopecks !== null && priceKopecks !== null && oldPriceKopecks <= priceKopecks) {
        throw new Error("oldPrice должна быть больше текущей price");
      }
      rows.push({
        rowNumber,
        category,
        categorySlug: slugify(category),
        name,
        slug,
        description: optionalText(parsed.data.description),
        priceKopecks,
        oldPriceKopecks,
        weightGrams: optionalPositiveInteger(parsed.data.weight, "weight"),
        image: optionalImage(parsed.data.image),
        available: optionalBoolean(parsed.data.available),
        sortOrder: optionalNonNegativeInteger(parsed.data.sortOrder, index),
      });
    } catch (error) {
      issues.push(`Строка ${rowNumber}: ${error instanceof Error ? error.message : "ошибка валидации"}`);
    }
  });
  if (!rows.length && !issues.length) issues.push("Меню не содержит строк");
  if (issues.length) throw new MenuImportError("validation", "Меню не прошло проверку", issues);
  return {
    sourceName,
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    format,
    rows,
  };
}

export async function applyMenuImport(
  tx: Prisma.TransactionClient,
  plan: MenuImportPlan,
  options: { dryRun: boolean; updateExisting: boolean },
): Promise<MenuImportResult> {
  if (await tx.catalogImport.findUnique({ where: { sourceSha256: plan.sourceSha256 } })) {
    throw new MenuImportError("duplicate_import", "Этот файл уже был импортирован");
  }

  const existingProducts = new Map(
    (await tx.product.findMany({
      where: { slug: { in: plan.rows.map((row) => row.slug) } },
      select: { id: true, slug: true },
    })).map((product) => [product.slug, product]),
  );
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  if (options.dryRun) {
    for (const row of plan.rows) {
      if (!existingProducts.has(row.slug)) createdCount++;
      else if (options.updateExisting) updatedCount++;
      else skippedCount++;
    }
    return { sourceSha256: plan.sourceSha256, createdCount, updatedCount, skippedCount, dryRun: true };
  }

  const categoryIds = new Map<string, string>();
  const categoryPositions = new Map<string, number>();
  for (const row of plan.rows) {
    categoryPositions.set(row.categorySlug, Math.min(categoryPositions.get(row.categorySlug) ?? row.sortOrder, row.sortOrder));
  }
  for (const row of plan.rows) {
    if (categoryIds.has(row.categorySlug)) continue;
    const category = await tx.category.upsert({
      where: { slug: row.categorySlug },
      create: {
        slug: row.categorySlug,
        name: row.category,
        position: categoryPositions.get(row.categorySlug) ?? 0,
      },
      update: {},
    });
    categoryIds.set(row.categorySlug, category.id);
  }

  for (const row of plan.rows) {
    const categoryId = categoryIds.get(row.categorySlug)!;
    const existing = existingProducts.get(row.slug);
    const unpriced = row.priceKopecks === null;
    const data = {
      categoryId,
      name: row.name,
      compositionText: row.description,
      portionNote: row.weightGrams ? `Порция ${row.weightGrams} г` : null,
      pricingType: "FIXED" as const,
      saleUnit: row.weightGrams ? "PORTION" as const : "PIECE" as const,
      basePriceKopecks: row.priceKopecks,
      oldPriceKopecks: row.oldPriceKopecks,
      unitPriceKopecks: null,
      priceUnitGrams: null,
      weightGrams: row.weightGrams,
      displayPriceLabel: unpriced ? "Цена уточняется" : rubleLabel(row.priceKopecks!),
      requiresPriceConfirmation: unpriced,
      isOrderable: !unpriced,
      isAvailable: row.available,
      position: row.sortOrder,
    };
    if (!existing) {
      await tx.product.create({
        data: {
          slug: row.slug,
          ...data,
          imagePath: row.image ?? "/images/product-placeholder.svg",
          fiscalVatCode: null,
          fiscalPaymentSubject: null,
          fiscalPaymentMode: null,
          fiscalMeasure: null,
        },
      });
      createdCount++;
    } else if (options.updateExisting) {
      await tx.product.update({
        where: { id: existing.id },
        data: {
          ...data,
          ...(row.image ? { imagePath: row.image } : {}),
          version: { increment: 1 },
        },
      });
      updatedCount++;
    } else {
      skippedCount++;
    }
  }

  await tx.catalogImport.create({
    data: {
      sourceSha256: plan.sourceSha256,
      sourceName: plan.sourceName.slice(0, 240),
      format: plan.format,
      createdCount,
      skippedCount: skippedCount + updatedCount,
    },
  });
  return { sourceSha256: plan.sourceSha256, createdCount, updatedCount, skippedCount, dryRun: false };
}

function csvObjects(text: string): Array<Record<string, string>> {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0]!.map((value) => value.trim());
  const missing = expectedColumns.filter((column) => !headers.includes(column));
  const unexpected = headers.filter((column) => !expectedColumns.includes(column as typeof expectedColumns[number]));
  if (missing.length || unexpected.length) {
    throw new MenuImportError(
      "validation",
      "Неверные колонки CSV",
      [
        ...(missing.length ? [`Отсутствуют: ${missing.join(", ")}`] : []),
        ...(unexpected.length ? [`Неизвестные: ${unexpected.join(", ")}`] : []),
      ],
    );
  }
  return rows.slice(1).filter((row) => row.some((value) => value.trim())).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index++;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"' && value.length === 0) quoted = true;
    else if (character === ",") { row.push(value); value = ""; }
    else if (character === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += character;
  }
  if (quoted) throw new MenuImportError("validation", "CSV содержит незакрытую кавычку");
  if (value.length || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

function jsonObjects(text: string): unknown[] {
  try {
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value)) throw new Error("Корень JSON должен быть массивом");
    return value;
  } catch (error) {
    throw new MenuImportError("validation", error instanceof Error ? error.message : "Некорректный JSON");
  }
}

function requiredText(value: string | number, field: string): string {
  const normalized = String(value).trim();
  if (!normalized || normalized.length > 200) throw new Error(`${field}: требуется строка длиной 1–200 символов`);
  return normalized;
}

function optionalText(value: string | number | null | undefined): string | null {
  const normalized = value === null || value === undefined ? "" : String(value).trim();
  if (normalized.length > 2_000) throw new Error("description: максимум 2000 символов");
  return normalized || null;
}

function optionalRubles(value: string | number | null | undefined, field: string): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error(`${field}: укажите рубли, не более двух знаков после запятой`);
  const [rubles, fraction = ""] = normalized.split(".");
  const kopecks = Number(rubles) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(kopecks) || kopecks <= 0) throw new Error(`${field}: цена должна быть положительной`);
  return kopecks;
}

function optionalPositiveInteger(value: string | number | null | undefined, field: string): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${field}: требуется положительное целое число`);
  return number;
}

function optionalNonNegativeInteger(value: string | number | null | undefined, fallback: number): number {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error("sortOrder: требуется неотрицательное целое число");
  return number;
}

function optionalBoolean(value: string | number | boolean | null | undefined): boolean {
  if (value === null || value === undefined || String(value).trim() === "") return true;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "да"].includes(normalized)) return true;
  if (["false", "0", "no", "нет"].includes(normalized)) return false;
  throw new Error("available: используйте true/false");
}

function optionalImage(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.startsWith("/") && !normalized.startsWith("//") && !normalized.includes("..")) return normalized;
  throw new Error("image: укажите локальный /path; внешнее изображение загрузите через админку в настроенное хранилище");
}

export function slugify(value: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  const transliterated = [...value.toLowerCase()].map((character) => map[character] ?? character).join("");
  const slug = transliterated.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("не удалось сформировать slug");
  return slug.slice(0, 120);
}

function rubleLabel(kopecks: number): string {
  const rubles = Math.floor(kopecks / 100);
  const fraction = kopecks % 100;
  return `${rubles}${fraction ? `,${String(fraction).padStart(2, "0")}` : ""} ₽`;
}
