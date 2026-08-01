import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import {
  CATEGORY_SEED,
  MODIFIER_GROUP_SEED,
  PRODUCT_SEED,
  STORE_SEED,
} from "@mangal/catalog-seed";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed PostgreSQL");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function seedCatalog(): Promise<void> {
  for (const category of CATEGORY_SEED) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        name: category.name,
        position: category.sortOrder,
      },
      update: {
        name: category.name,
        position: category.sortOrder,
        isActive: true,
      },
    });
  }

  const categories = await prisma.category.findMany();
  const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));

  for (const product of PRODUCT_SEED) {
    const categoryId = categoryIds.get(product.categorySlug);
    if (!categoryId) throw new Error(`Unknown seed category ${product.categorySlug}`);

    const data = {
      categoryId,
      name: product.name,
      compositionText: product.compositionText ?? null,
      portionNote: product.portionNote ?? null,
      pricingType: product.pricingType,
      saleUnit: product.saleUnit,
      basePriceKopecks: product.basePriceKopecks ?? null,
      unitPriceKopecks: product.unitPriceKopecks ?? null,
      priceUnitGrams: product.priceUnitGrams ?? null,
      weightGrams: product.weightGrams ?? null,
      displayPriceLabel: product.displayPriceLabel,
      requiresPriceConfirmation: product.requiresPriceConfirmation ?? false,
      isOrderable: product.isOrderable ?? true,
      isAvailable: true,
      imagePath: "/images/product-placeholder.svg",
      fiscalVatCode: "1",
      fiscalPaymentSubject: "1",
      fiscalPaymentMode: "1",
      fiscalMeasure: "1",
    } as const;

    await prisma.product.upsert({
      where: { slug: product.slug },
      create: { slug: product.slug, ...data },
      update: data,
    });
  }

  for (const [groupPosition, groupSeed] of MODIFIER_GROUP_SEED.entries()) {
    const group = await prisma.modifierGroup.upsert({
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
      update: {
        name: groupSeed.name,
        kind: groupSeed.kind,
        selectionMode: groupSeed.selectionMode,
        required: groupSeed.required,
        minSelect: groupSeed.minSelect,
        maxSelect: groupSeed.maxSelect,
        position: groupPosition,
        isActive: true,
      },
    });

    for (const [optionPosition, option] of groupSeed.options.entries()) {
      await prisma.modifierOption.upsert({
        where: { groupId_slug: { groupId: group.id, slug: option.key } },
        create: {
          groupId: group.id,
          slug: option.key,
          name: option.name,
          priceDeltaKopecks: option.priceDeltaKopecks,
          position: optionPosition,
        },
        update: {
          name: option.name,
          priceDeltaKopecks: option.priceDeltaKopecks,
          position: optionPosition,
          isAvailable: true,
        },
      });
    }

    const products = await prisma.product.findMany({
      where: { slug: { in: [...groupSeed.productSlugs] } },
      select: { id: true, slug: true },
    });
    if (products.length !== groupSeed.productSlugs.length) {
      throw new Error(`Modifier group ${groupSeed.key} references a missing product`);
    }

    await prisma.productModifierGroup.deleteMany({ where: { modifierGroupId: group.id } });
    await prisma.productModifierGroup.createMany({
      data: products.map((product) => ({
        productId: product.id,
        modifierGroupId: group.id,
        position: groupPosition,
      })),
    });
  }
}

async function seedLegalDrafts(): Promise<void> {
  const documents = [
    { type: "PERSONAL_DATA" as const, version: "pd-v1", path: "docs/legal/pd-v1.md" },
    { type: "MARKETING" as const, version: "marketing-v1", path: "docs/legal/marketing-v1.md" },
    { type: "COOKIE" as const, version: "cookie-v1", path: "docs/legal/cookie-v1.md" },
    { type: "OFFER" as const, version: "offer-v1", path: "docs/legal/offer-v1.md" },
    { type: "TERMS" as const, version: "terms-v1", path: "docs/legal/terms-v1.md" },
  ];

  for (const document of documents) {
    const contentSha256 = await sha256File(resolve(document.path));
    const existing = await prisma.legalDocumentVersion.findUnique({
      where: { type_version: { type: document.type, version: document.version } },
      select: { approved: true, contentSha256: true },
    });
    await prisma.legalDocumentVersion.upsert({
      where: { type_version: { type: document.type, version: document.version } },
      create: {
        type: document.type,
        version: document.version,
        documentPath: `/${document.path}`,
        contentSha256,
        approved: false,
      },
      update: {
        documentPath: `/${document.path}`,
        contentSha256,
        approved: existing?.contentSha256 === contentSha256 ? existing.approved : false,
        ...(existing?.contentSha256 !== contentSha256 ? { activeFrom: null } : {}),
      },
    });
  }
}

async function main(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.storeSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        ...STORE_SEED,
        legalBasis: process.env.PERSONAL_DATA_LEGAL_BASIS === "CONSENT" ? "CONSENT" : "CONTRACT",
        taxSystemCode: "0",
      },
      update: {
        ...STORE_SEED,
        taxSystemCode: "0",
      },
    });
    await tx.migrationSentinel.upsert({
      where: { id: 1 },
      create: { id: 1, version: "202608010001_initial" },
      update: { version: "202608010001_initial" },
    });
    await tx.deliveryZone.upsert({
      where: { id: "ad72a135-8f23-4c9d-9db5-b64fb440e23f" },
      create: {
        id: "ad72a135-8f23-4c9d-9db5-b64fb440e23f",
        name: "Центр (Саратов)",
        city: "Саратов",
        feeKopecks: 20000,
        isActive: true,
      },
      update: {
        name: "Центр (Саратов)",
        city: "Саратов",
        feeKopecks: 20000,
        isActive: true,
      },
    });
    await tx.paymentRouting.upsert({
      where: { method: "CARD" },
      create: { method: "CARD", provider: "YOOKASSA", isActive: true },
      update: { provider: "YOOKASSA", isActive: true },
    });
    await tx.paymentRouting.upsert({
      where: { method: "SBP" },
      create: { method: "SBP", provider: "TBANK", isActive: true },
      update: { provider: "TBANK", isActive: true },
    });
    for (let day = 0; day <= 6; day++) {
      await tx.operatingHours.upsert({
        where: { weekday: day },
        create: { weekday: day, opensAt: "00:00", closesAt: "23:59", isClosed: false, slotLength: 15 },
        update: { opensAt: "00:00", closesAt: "23:59", isClosed: false, slotLength: 15 },
      });
    }
  });
  await seedCatalog();
  await seedLegalDrafts();
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Seed failed"}\n`);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
