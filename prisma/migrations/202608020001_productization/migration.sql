-- Productization is additive. Existing storefront/order data remains valid.
CREATE TYPE "RestaurantTheme" AS ENUM ('MANGAL_DARK', 'CAFE_LIGHT', 'SUSHI_MINIMAL');
CREATE TYPE "StorageDriver" AS ENUM ('LOCAL', 'VERCEL_BLOB');
CREATE TYPE "FulfillmentMethod" AS ENUM ('DELIVERY', 'PICKUP');
CREATE TYPE "CatalogImportFormat" AS ENUM ('CSV', 'JSON');

ALTER TABLE "Product"
  ADD COLUMN "imageAssetId" UUID,
  ADD COLUMN "oldPriceKopecks" INTEGER,
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order"
  ADD COLUMN "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'DELIVERY',
  ALTER COLUMN "deliveryZoneId" DROP NOT NULL,
  ALTER COLUMN "cityEncrypted" DROP NOT NULL,
  ALTER COLUMN "streetEncrypted" DROP NOT NULL,
  ALTER COLUMN "houseEncrypted" DROP NOT NULL;

CREATE TABLE "RestaurantProfile" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "logoPath" TEXT,
  "logoAssetId" UUID,
  "faviconPath" TEXT,
  "faviconAssetId" UUID,
  "heroImagePath" TEXT,
  "heroImageAssetId" UUID,
  "theme" "RestaurantTheme" NOT NULL DEFAULT 'MANGAL_DARK',
  "primaryColor" TEXT NOT NULL DEFAULT '#E04E1B',
  "secondaryColor" TEXT NOT NULL DEFAULT '#C89D5C',
  "backgroundColor" TEXT NOT NULL DEFAULT '#0D0D0E',
  "foregroundColor" TEXT NOT NULL DEFAULT '#F4F1EA',
  "phoneDisplay" TEXT,
  "phoneHref" TEXT,
  "email" TEXT,
  "address" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "vkUrl" TEXT,
  "telegramUrl" TEXT,
  "whatsappUrl" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Saratov',
  "seoTitle" TEXT NOT NULL,
  "seoDescription" TEXT NOT NULL,
  "legalName" TEXT,
  "legalInn" TEXT,
  "legalRegistrationNo" TEXT,
  "legalAddress" TEXT,
  "privacyPolicyPath" TEXT NOT NULL DEFAULT '/legal/privacy',
  "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
  "pickupEnabled" BOOLEAN NOT NULL DEFAULT false,
  "pickupLabel" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RestaurantProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaAsset" (
  "id" UUID NOT NULL,
  "publicId" TEXT NOT NULL,
  "storageDriver" "StorageDriver" NOT NULL,
  "objectKey" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "sha256" TEXT NOT NULL,
  "altText" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "deletedAt" TIMESTAMPTZ(3),
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogImport" (
  "id" UUID NOT NULL,
  "sourceSha256" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "format" "CatalogImportFormat" NOT NULL,
  "createdCount" INTEGER NOT NULL,
  "skippedCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryFiscalSnapshot" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "fiscalName" TEXT NOT NULL,
  "unitPriceKopecks" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "amountKopecks" INTEGER NOT NULL,
  "vatCode" TEXT NOT NULL,
  "taxSystemCode" TEXT NOT NULL,
  "paymentSubject" TEXT NOT NULL,
  "paymentMode" TEXT NOT NULL,
  "measure" TEXT NOT NULL,
  "providerReceiptId" TEXT,
  "sourceReceiptPayloadHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryFiscalSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RestaurantProfile_slug_key" ON "RestaurantProfile"("slug");
CREATE UNIQUE INDEX "MediaAsset_publicId_key" ON "MediaAsset"("publicId");
CREATE UNIQUE INDEX "MediaAsset_objectKey_key" ON "MediaAsset"("objectKey");
CREATE INDEX "MediaAsset_storageDriver_createdAt_idx" ON "MediaAsset"("storageDriver", "createdAt");
CREATE INDEX "MediaAsset_sha256_idx" ON "MediaAsset"("sha256");
CREATE UNIQUE INDEX "CatalogImport_sourceSha256_key" ON "CatalogImport"("sourceSha256");
CREATE INDEX "CatalogImport_createdAt_idx" ON "CatalogImport"("createdAt");
CREATE UNIQUE INDEX "DeliveryFiscalSnapshot_orderId_key" ON "DeliveryFiscalSnapshot"("orderId");
CREATE INDEX "Product_categoryId_position_idx" ON "Product"("categoryId", "position");
CREATE INDEX "Product_imageAssetId_idx" ON "Product"("imageAssetId");
CREATE INDEX "RestaurantProfile_logoAssetId_idx" ON "RestaurantProfile"("logoAssetId");
CREATE INDEX "RestaurantProfile_faviconAssetId_idx" ON "RestaurantProfile"("faviconAssetId");
CREATE INDEX "RestaurantProfile_heroImageAssetId_idx" ON "RestaurantProfile"("heroImageAssetId");
CREATE UNIQUE INDEX "PaymentAttempt_provider_externalPaymentId_key" ON "PaymentAttempt"("provider", "externalPaymentId");
CREATE UNIQUE INDEX "Refund_externalRefundId_key" ON "Refund"("externalRefundId");

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_imageAssetId_fkey"
  FOREIGN KEY ("imageAssetId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RestaurantProfile"
  ADD CONSTRAINT "RestaurantProfile_logoAssetId_fkey"
  FOREIGN KEY ("logoAssetId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RestaurantProfile"
  ADD CONSTRAINT "RestaurantProfile_faviconAssetId_fkey"
  FOREIGN KEY ("faviconAssetId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RestaurantProfile"
  ADD CONSTRAINT "RestaurantProfile_heroImageAssetId_fkey"
  FOREIGN KEY ("heroImageAssetId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeliveryFiscalSnapshot"
  ADD CONSTRAINT "DeliveryFiscalSnapshot_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Product" ADD CONSTRAINT "Product_position_check" CHECK ("position" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_positive_price_check" CHECK (
  ("basePriceKopecks" IS NULL OR "basePriceKopecks" > 0) AND
  ("unitPriceKopecks" IS NULL OR "unitPriceKopecks" > 0)
);
ALTER TABLE "Product" ADD CONSTRAINT "Product_oldPriceKopecks_check" CHECK (
  "oldPriceKopecks" IS NULL OR (
    "oldPriceKopecks" > 0 AND
    "oldPriceKopecks" > COALESCE("basePriceKopecks", "unitPriceKopecks")
  )
);
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_byteSize_check" CHECK ("byteSize" > 0);
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_dimensions_check" CHECK (("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0));
ALTER TABLE "RestaurantProfile" ADD CONSTRAINT "RestaurantProfile_colors_check" CHECK (
  "primaryColor" ~ '^#[0-9A-Fa-f]{6}$' AND
  "secondaryColor" ~ '^#[0-9A-Fa-f]{6}$' AND
  "backgroundColor" ~ '^#[0-9A-Fa-f]{6}$' AND
  "foregroundColor" ~ '^#[0-9A-Fa-f]{6}$'
);
ALTER TABLE "CatalogImport" ADD CONSTRAINT "CatalogImport_counts_check" CHECK ("createdCount" >= 0 AND "skippedCount" >= 0);
ALTER TABLE "DeliveryFiscalSnapshot" ADD CONSTRAINT "DeliveryFiscalSnapshot_values_check" CHECK (
  "unitPriceKopecks" >= 0 AND "quantity" > 0 AND "amountKopecks" >= 0
);

UPDATE "MigrationSentinel"
SET "version" = '202608020001_productization', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 1;
