import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../generated/prisma/client";
import {
  CATEGORY_SEED,
  MODIFIER_GROUP_SEED,
  PRODUCT_SEED,
  STORE_SEED,
} from "@mangal/catalog-seed";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed PostgreSQL");

const replaceCatalog = process.argv.includes("--replace-catalog");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });

type LegalDraft = {
  type: "PERSONAL_DATA" | "MARKETING" | "COOKIE" | "OFFER" | "TERMS";
  version: string;
  filePath: string;
  documentPath: string;
  contentSha256: string;
};

async function legalDrafts(): Promise<LegalDraft[]> {
  const documents = [
    { type: "PERSONAL_DATA" as const, version: "pd-v1", filePath: "docs/legal/pd-v1.md", documentPath: "/legal/privacy" },
    { type: "MARKETING" as const, version: "marketing-v1", filePath: "docs/legal/marketing-v1.md", documentPath: "/legal/marketing" },
    { type: "COOKIE" as const, version: "cookie-v1", filePath: "docs/legal/cookie-v1.md", documentPath: "/legal/cookies" },
    { type: "OFFER" as const, version: "offer-v1", filePath: "docs/legal/offer-v1.md", documentPath: "/legal/offer" },
    { type: "TERMS" as const, version: "terms-v1", filePath: "docs/legal/terms-v1.md", documentPath: "/legal/terms" },
  ];
  return Promise.all(documents.map(async (document) => ({
    ...document,
    contentSha256: createHash("sha256").update(await readFile(resolve(document.filePath))).digest("hex"),
  })));
}

async function main(): Promise<void> {
  const drafts = await legalDrafts();
  await prisma.$transaction(async (tx) => {
    const [categoryCount, productCount, modifierGroupCount] = await Promise.all([
      tx.category.count(),
      tx.product.count(),
      tx.modifierGroup.count(),
    ]);
    const catalogIsEmpty = categoryCount === 0 && productCount === 0 && modifierGroupCount === 0;
    const catalogIsComplete =
      productCount === PRODUCT_SEED.length &&
      categoryCount >= CATEGORY_SEED.length &&
      modifierGroupCount >= MODIFIER_GROUP_SEED.length;
    if (!catalogIsEmpty && !catalogIsComplete && !replaceCatalog) {
      throw new Error(
        "Catalog is partially populated. Refusing to overwrite operator edits; inspect it or rerun with --replace-catalog explicitly.",
      );
    }

    await tx.restaurantProfile.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        slug: "mangal",
        name: "МАНГАЛ",
        description: "Онлайн-меню заведения «МАНГАЛ».",
        theme: "MANGAL_DARK",
        primaryColor: "#E04E1B",
        secondaryColor: "#C89D5C",
        backgroundColor: "#0D0D0E",
        foregroundColor: "#F4F1EA",
        phoneDisplay: STORE_SEED.phoneDisplay,
        phoneHref: STORE_SEED.phoneHref,
        currency: "RUB",
        timezone: "Europe/Saratov",
        seoTitle: "МАНГАЛ — онлайн-меню",
        seoDescription: "Актуальное меню заведения «МАНГАЛ». Способы получения настраиваются оператором.",
        privacyPolicyPath: "/legal/privacy",
        deliveryEnabled: false,
        pickupEnabled: false,
      },
      update: {},
    });
    await tx.storeSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        ...STORE_SEED,
        legalBasis: process.env.PERSONAL_DATA_LEGAL_BASIS === "CONSENT" ? "CONSENT" : "CONTRACT",
        taxSystemCode: null,
      },
      update: {},
    });

    for (const draft of drafts) {
      const existing = await tx.legalDocumentVersion.findUnique({
        where: { type_version: { type: draft.type, version: draft.version } },
      });
      if (existing && existing.contentSha256 !== draft.contentSha256) {
        throw new Error(
          `Legal document ${draft.type}/${draft.version} changed. Create a new version instead of mutating immutable consent evidence.`,
        );
      }
      if (!existing) {
        await tx.legalDocumentVersion.create({
          data: {
            type: draft.type,
            version: draft.version,
            documentPath: draft.documentPath,
            contentSha256: draft.contentSha256,
            approved: false,
          },
        });
      }
    }

    if (catalogIsEmpty || replaceCatalog) {
      await seedCatalog(tx, replaceCatalog);
    } else {
      const existingSlugs = new Set((await tx.product.findMany({ select: { slug: true } })).map((product) => product.slug));
      const missing = PRODUCT_SEED.filter((product) => !existingSlugs.has(product.slug));
      if (missing.length) {
        throw new Error(`Existing catalog has ${productCount} products but misses seed slugs: ${missing.map((item) => item.slug).join(", ")}`);
      }
    }
  }, { timeout: 60_000 });
}

async function seedCatalog(tx: Prisma.TransactionClient, replace: boolean): Promise<void> {
  const categoryIds = new Map<string, string>();
  for (const category of CATEGORY_SEED) {
    const stored = await tx.category.upsert({
      where: { slug: category.slug },
      create: { slug: category.slug, name: category.name, position: category.sortOrder },
      update: replace ? { name: category.name, position: category.sortOrder, isActive: true } : {},
    });
    categoryIds.set(category.slug, stored.id);
  }

  const productIds = new Map<string, string>();
  const positions = new Map<string, number>();
  for (const product of PRODUCT_SEED) {
    const categoryId = categoryIds.get(product.categorySlug);
    if (!categoryId) throw new Error(`Unknown seed category ${product.categorySlug}`);
    const position = positions.get(product.categorySlug) ?? 0;
    positions.set(product.categorySlug, position + 1);
    const data = {
      categoryId,
      name: product.name,
      compositionText: product.compositionText ?? null,
      portionNote: product.portionNote ?? null,
      pricingType: product.pricingType,
      saleUnit: product.saleUnit,
      basePriceKopecks: product.basePriceKopecks ?? null,
      oldPriceKopecks: null,
      unitPriceKopecks: product.unitPriceKopecks ?? null,
      priceUnitGrams: product.priceUnitGrams ?? null,
      weightGrams: product.weightGrams ?? null,
      displayPriceLabel: product.displayPriceLabel,
      requiresPriceConfirmation: product.requiresPriceConfirmation ?? false,
      isOrderable: product.isOrderable ?? true,
      isAvailable: true,
      imagePath: "/images/product-placeholder.svg",
      position,
      fiscalVatCode: null,
      fiscalPaymentSubject: null,
      fiscalPaymentMode: null,
      fiscalMeasure: null,
    } as const;
    const stored = await tx.product.upsert({
      where: { slug: product.slug },
      create: { slug: product.slug, ...data },
      update: replace ? { ...data, version: { increment: 1 } } : {},
    });
    productIds.set(product.slug, stored.id);
  }

  for (const [groupPosition, groupSeed] of MODIFIER_GROUP_SEED.entries()) {
    const group = await tx.modifierGroup.upsert({
      where: { slug: groupSeed.key },
      create: {
        slug: groupSeed.key,
        name: groupSeed.name,
        kind: groupSeed.kind,
        selectionMode: groupSeed.selectionMode,
        required: groupSeed.required,
        minSelect: groupSeed.minSelect,
        maxSelect: groupSeed.maxSelect,
        position: groupPosition,
      },
      update: replace
        ? {
            name: groupSeed.name,
            kind: groupSeed.kind,
            selectionMode: groupSeed.selectionMode,
            required: groupSeed.required,
            minSelect: groupSeed.minSelect,
            maxSelect: groupSeed.maxSelect,
            position: groupPosition,
            isActive: true,
          }
        : {},
    });
    for (const [optionPosition, option] of groupSeed.options.entries()) {
      await tx.modifierOption.upsert({
        where: { groupId_slug: { groupId: group.id, slug: option.key } },
        create: {
          groupId: group.id,
          slug: option.key,
          name: option.name,
          priceDeltaKopecks: option.priceDeltaKopecks,
          position: optionPosition,
        },
        update: replace
          ? {
              name: option.name,
              priceDeltaKopecks: option.priceDeltaKopecks,
              position: optionPosition,
              isAvailable: true,
            }
          : {},
      });
    }
    if (replace) await tx.productModifierGroup.deleteMany({ where: { modifierGroupId: group.id } });
    for (const productSlug of groupSeed.productSlugs) {
      const productId = productIds.get(productSlug);
      if (!productId) throw new Error(`Modifier group ${groupSeed.key} references missing product ${productSlug}`);
      await tx.productModifierGroup.upsert({
        where: { productId_modifierGroupId: { productId, modifierGroupId: group.id } },
        create: { productId, modifierGroupId: group.id, position: groupPosition },
        update: replace ? { position: groupPosition } : {},
      });
    }
  }
}

main()
  .then(async () => {
    process.stdout.write(`Seed complete: ${PRODUCT_SEED.length} menu products; production-only values remain unset.\n`);
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Seed failed"}\n`);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
