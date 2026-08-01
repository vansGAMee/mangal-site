-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('FIXED', 'PER_KILOGRAM');

-- CreateEnum
CREATE TYPE "SaleUnit" AS ENUM ('PIECE', 'PORTION', 'KILOGRAM');

-- CreateEnum
CREATE TYPE "ModifierKind" AS ENUM ('OTHER');

-- CreateEnum
CREATE TYPE "SelectionMode" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'SBP');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('YOOKASSA', 'TBANK');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'REFUND_PENDING', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('NEW', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCEL_REQUESTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'INITIALIZING', 'REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PaymentOperationType" AS ENUM ('INIT', 'GET_STATE', 'REFUND', 'GET_REFUND_STATE');

-- CreateEnum
CREATE TYPE "PaymentOperationStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'UNKNOWN', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "ReconciliationTaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'RESOLVED', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PERSONAL_DATA', 'MARKETING', 'COOKIE', 'OFFER', 'TERMS');

-- CreateEnum
CREATE TYPE "ConsentDecision" AS ENUM ('GRANTED', 'DECLINED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "LegalBasis" AS ENUM ('CONTRACT', 'CONSENT');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'MANAGER');

-- CreateEnum
CREATE TYPE "AdminPermissionCode" AS ENUM ('REFUND_ORDER');

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "publicId" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "compositionText" TEXT,
    "portionNote" TEXT,
    "pricingType" "PricingType" NOT NULL,
    "saleUnit" "SaleUnit" NOT NULL,
    "basePriceKopecks" INTEGER,
    "unitPriceKopecks" INTEGER,
    "priceUnitGrams" INTEGER,
    "weightGrams" INTEGER,
    "quantityStep" INTEGER NOT NULL DEFAULT 1,
    "displayPriceLabel" TEXT NOT NULL,
    "requiresPriceConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "isOrderable" BOOLEAN NOT NULL DEFAULT true,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "caloriesKcal" INTEGER,
    "allergens" TEXT,
    "imagePath" TEXT NOT NULL DEFAULT '/images/product-placeholder.svg',
    "fiscalVatCode" TEXT,
    "fiscalPaymentSubject" TEXT,
    "fiscalPaymentMode" TEXT,
    "fiscalMeasure" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierGroup" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ModifierKind" NOT NULL,
    "selectionMode" "SelectionMode" NOT NULL,
    "required" BOOLEAN NOT NULL,
    "minSelect" INTEGER NOT NULL,
    "maxSelect" INTEGER,
    "position" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierOption" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDeltaKopecks" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ModifierOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModifierGroup" (
    "productId" UUID NOT NULL,
    "modifierGroupId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ProductModifierGroup_pkey" PRIMARY KEY ("productId","modifierGroupId")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "phoneDisplay" TEXT NOT NULL,
    "phoneHref" TEXT NOT NULL,
    "leadTimeMinutes" INTEGER NOT NULL,
    "minimumOrderKopecks" INTEGER,
    "deliveryPricingConfig" JSONB,
    "legalBasis" "LegalBasis" NOT NULL,
    "taxSystemCode" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" UUID NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "feeKopecks" INTEGER NOT NULL,
    "freeThresholdKopecks" INTEGER,
    "minOrderKopecks" INTEGER,
    "polygon" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatingHours" (
    "id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "slotLength" INTEGER NOT NULL,
    "capacity" INTEGER,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperatingHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRouting" (
    "method" "PaymentMethod" NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentRouting_pkey" PRIMARY KEY ("method")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "publicId" TEXT NOT NULL,
    "checkoutId" UUID NOT NULL,
    "checkoutRequestHash" TEXT NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'NEW',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "subtotalKopecks" INTEGER NOT NULL,
    "deliveryFeeKopecks" INTEGER NOT NULL,
    "totalKopecks" INTEGER NOT NULL,
    "deliveryZoneId" UUID NOT NULL,
    "deliverySlotStart" TIMESTAMPTZ(3) NOT NULL,
    "phoneEncrypted" JSONB NOT NULL,
    "phoneLookupHash" TEXT NOT NULL,
    "emailEncrypted" JSONB,
    "cityEncrypted" JSONB NOT NULL,
    "streetEncrypted" JSONB NOT NULL,
    "houseEncrypted" JSONB NOT NULL,
    "apartmentEncrypted" JSONB,
    "entranceEncrypted" JSONB,
    "floorEncrypted" JSONB,
    "intercomEncrypted" JSONB,
    "commentEncrypted" JSONB,
    "taxSystemSnapshot" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID,
    "productVersionSnapshot" INTEGER NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "compositionSnapshot" TEXT,
    "portionNoteSnapshot" TEXT,
    "pricingTypeSnapshot" "PricingType" NOT NULL,
    "saleUnitSnapshot" "SaleUnit" NOT NULL,
    "unitPriceKopecks" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotalKopecks" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemModifier" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "modifierOptionId" UUID,
    "groupNameSnapshot" TEXT NOT NULL,
    "optionNameSnapshot" TEXT NOT NULL,
    "priceDeltaKopecks" INTEGER NOT NULL,

    CONSTRAINT "OrderItemModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalItemSnapshot" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
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

    CONSTRAINT "FiscalItemSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL,
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL,
    "reasonCode" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocumentVersion" (
    "id" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "documentPath" TEXT NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "activeFrom" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalConsent" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "legalDocumentVersionId" UUID,
    "type" "ConsentType" NOT NULL,
    "decision" "ConsentDecision" NOT NULL,
    "version" TEXT NOT NULL,
    "documentPath" TEXT NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "ipEncrypted" JSONB NOT NULL,
    "normalizedUserAgent" TEXT NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMPTZ(3),
    "withdrawalSource" TEXT,
    "legalBasis" "LegalBasis" NOT NULL,

    CONSTRAINT "LegalConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" TEXT NOT NULL,
    "externalPaymentId" TEXT,
    "providerRequestId" TEXT,
    "amountKopecks" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "confirmationType" TEXT,
    "confirmationUrl" TEXT,
    "confirmationData" TEXT,
    "lastProviderStatus" TEXT,
    "failureCode" TEXT,
    "initializedAt" TIMESTAMPTZ(3),
    "lastCheckedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOperation" (
    "id" UUID NOT NULL,
    "paymentAttemptId" UUID NOT NULL,
    "type" "PaymentOperationType" NOT NULL,
    "status" "PaymentOperationStatus" NOT NULL,
    "providerRequestId" TEXT,
    "requestHash" TEXT NOT NULL,
    "responseHash" TEXT,
    "errorCode" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PaymentOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "externalPaymentId" TEXT,
    "paymentAttemptId" UUID,
    "payloadHash" TEXT NOT NULL,
    "providerStatus" TEXT,
    "verified" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMPTZ(3),
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReconciliationTask" (
    "id" UUID NOT NULL,
    "paymentAttemptId" UUID NOT NULL,
    "status" "ReconciliationTaskStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMPTZ(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentReconciliationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "paymentAttemptId" UUID NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'CREATED',
    "amountKopecks" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "externalRefundId" TEXT,
    "providerRequestId" TEXT,
    "failureCode" TEXT,
    "createdByAdminId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 12,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMPTZ(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
    "mfaEnrolledAt" TIMESTAMPTZ(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "passwordChangedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfTokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminTotpCredential" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "secretEncrypted" JSONB NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminTotpCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRecoveryCode" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminPermission" (
    "adminUserId" UUID NOT NULL,
    "code" "AdminPermissionCode" NOT NULL,
    "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("adminUserId","code")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "orderId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "keyHash" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("keyHash")
);

-- CreateTable
CREATE TABLE "SystemNotification" (
    "id" UUID NOT NULL,
    "orderId" UUID,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(3),

    CONSTRAINT "SystemNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationSentinel" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "version" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MigrationSentinel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_isActive_position_idx" ON "Category"("isActive", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Product_publicId_key" ON "Product"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_isAvailable_idx" ON "Product"("categoryId", "isAvailable");

-- CreateIndex
CREATE INDEX "Product_isOrderable_isAvailable_idx" ON "Product"("isOrderable", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "ModifierGroup_slug_key" ON "ModifierGroup"("slug");

-- CreateIndex
CREATE INDEX "ModifierOption_groupId_isAvailable_idx" ON "ModifierOption"("groupId", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "ModifierOption_groupId_slug_key" ON "ModifierOption"("groupId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryZone_publicId_key" ON "DeliveryZone"("publicId");

-- CreateIndex
CREATE INDEX "DeliveryZone_isActive_idx" ON "DeliveryZone"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OperatingHours_weekday_key" ON "OperatingHours"("weekday");

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicId_key" ON "Order"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutId_key" ON "Order"("checkoutId");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Order_fulfillmentStatus_createdAt_idx" ON "Order"("fulfillmentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Order_phoneLookupHash_idx" ON "Order"("phoneLookupHash");

-- CreateIndex
CREATE INDEX "Order_deliverySlotStart_idx" ON "Order"("deliverySlotStart");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItemModifier_orderItemId_idx" ON "OrderItemModifier"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalItemSnapshot_orderItemId_key" ON "FiscalItemSnapshot"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocumentVersion_type_version_key" ON "LegalDocumentVersion"("type", "version");

-- CreateIndex
CREATE INDEX "LegalConsent_orderId_type_idx" ON "LegalConsent"("orderId", "type");

-- CreateIndex
CREATE INDEX "LegalConsent_type_version_acceptedAt_idx" ON "LegalConsent"("type", "version", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_idempotencyKey_key" ON "PaymentAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_updatedAt_idx" ON "PaymentAttempt"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "PaymentAttempt_externalPaymentId_idx" ON "PaymentAttempt"("externalPaymentId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_orderId_createdAt_idx" ON "PaymentAttempt"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentOperation_paymentAttemptId_createdAt_idx" ON "PaymentOperation"("paymentAttemptId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_fingerprint_key" ON "PaymentWebhookEvent"("fingerprint");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_provider_externalPaymentId_idx" ON "PaymentWebhookEvent"("provider", "externalPaymentId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_processedAt_receivedAt_idx" ON "PaymentWebhookEvent"("processedAt", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentReconciliationTask_status_availableAt_idx" ON "PaymentReconciliationTask"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_status_updatedAt_idx" ON "Refund"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Refund_externalRefundId_idx" ON "Refund"("externalRefundId");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scope_key_key" ON "IdempotencyRecord"("scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_emailNormalized_key" ON "AdminUser"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminUserId_revokedAt_idx" ON "AdminSession"("adminUserId", "revokedAt");

-- CreateIndex
CREATE INDEX "AdminSession_idleExpiresAt_idx" ON "AdminSession"("idleExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminTotpCredential_adminUserId_key" ON "AdminTotpCredential"("adminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRecoveryCode_adminUserId_codeHash_key" ON "AdminRecoveryCode"("adminUserId", "codeHash");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_createdAt_idx" ON "AdminAuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE INDEX "SystemNotification_status_createdAt_idx" ON "SystemNotification"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModifierOption" ADD CONSTRAINT "ModifierOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModifierGroup" ADD CONSTRAINT "ProductModifierGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModifierGroup" ADD CONSTRAINT "ProductModifierGroup_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_modifierOptionId_fkey" FOREIGN KEY ("modifierOptionId") REFERENCES "ModifierOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalItemSnapshot" ADD CONSTRAINT "FiscalItemSnapshot_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalConsent" ADD CONSTRAINT "LegalConsent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalConsent" ADD CONSTRAINT "LegalConsent_legalDocumentVersionId_fkey" FOREIGN KEY ("legalDocumentVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOperation" ADD CONSTRAINT "PaymentOperation_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationTask" ADD CONSTRAINT "PaymentReconciliationTask_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTotpCredential" ADD CONSTRAINT "AdminTotpCredential_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRecoveryCode" ADD CONSTRAINT "AdminRecoveryCode_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminPermission" ADD CONSTRAINT "AdminPermission_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemNotification" ADD CONSTRAINT "SystemNotification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminSession" ADD COLUMN "reauthUntil" TIMESTAMPTZ(3), ADD COLUMN "reauthNonceHash" TEXT;
ALTER TABLE "AdminTotpCredential" ADD COLUMN "lastCounter" INTEGER;

-- Domain invariants which Prisma cannot express directly.
ALTER TABLE "Product" ADD CONSTRAINT "Product_non_negative_prices_check"
  CHECK (("basePriceKopecks" IS NULL OR "basePriceKopecks" >= 0)
    AND ("unitPriceKopecks" IS NULL OR "unitPriceKopecks" >= 0));
ALTER TABLE "Product" ADD CONSTRAINT "Product_positive_measurements_check"
  CHECK (("weightGrams" IS NULL OR "weightGrams" > 0)
    AND ("priceUnitGrams" IS NULL OR "priceUnitGrams" > 0)
    AND "quantityStep" > 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_pricing_shape_check"
  CHECK (
    ("requiresPriceConfirmation" = TRUE AND "isOrderable" = FALSE AND "basePriceKopecks" IS NULL AND "unitPriceKopecks" IS NULL)
    OR ("pricingType" = 'FIXED' AND "basePriceKopecks" IS NOT NULL AND "unitPriceKopecks" IS NULL AND "priceUnitGrams" IS NULL)
    OR ("pricingType" = 'PER_KILOGRAM' AND "saleUnit" = 'KILOGRAM' AND "unitPriceKopecks" IS NOT NULL AND "priceUnitGrams" = 1000 AND "basePriceKopecks" IS NULL)
  );
ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_selection_range_check"
  CHECK ("minSelect" >= 0 AND ("maxSelect" IS NULL OR "maxSelect" >= "minSelect")
    AND ("required" = FALSE OR "minSelect" > 0));
ALTER TABLE "ModifierOption" ADD CONSTRAINT "ModifierOption_non_negative_delta_check"
  CHECK ("priceDeltaKopecks" >= 0);
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_values_check"
  CHECK ("leadTimeMinutes" > 0 AND ("minimumOrderKopecks" IS NULL OR "minimumOrderKopecks" >= 0));
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_values_check"
  CHECK ("feeKopecks" >= 0 AND ("freeThresholdKopecks" IS NULL OR "freeThresholdKopecks" >= 0)
    AND ("minOrderKopecks" IS NULL OR "minOrderKopecks" >= 0));
ALTER TABLE "OperatingHours" ADD CONSTRAINT "OperatingHours_values_check"
  CHECK ("weekday" BETWEEN 0 AND 6 AND "slotLength" > 0 AND ("capacity" IS NULL OR "capacity" > 0));
ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_check"
  CHECK ("subtotalKopecks" >= 0 AND "deliveryFeeKopecks" >= 0 AND "totalKopecks" = "subtotalKopecks" + "deliveryFeeKopecks" AND "currency" = 'RUB');
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_amounts_check"
  CHECK ("unitPriceKopecks" >= 0 AND "quantity" > 0 AND "lineTotalKopecks" >= 0);
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_delta_check"
  CHECK ("priceDeltaKopecks" >= 0);
ALTER TABLE "FiscalItemSnapshot" ADD CONSTRAINT "FiscalItemSnapshot_amounts_check"
  CHECK ("unitPriceKopecks" >= 0 AND "quantity" > 0 AND "amountKopecks" >= 0);
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_amount_check"
  CHECK ("amountKopecks" > 0 AND "currency" = 'RUB');
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_check"
  CHECK ("amountKopecks" > 0 AND "currency" = 'RUB');
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_attempts_check"
  CHECK ("attempts" >= 0 AND "maxAttempts" > 0 AND "attempts" <= "maxAttempts");
ALTER TABLE "PaymentReconciliationTask" ADD CONSTRAINT "PaymentReconciliationTask_attempts_check"
  CHECK ("attempts" >= 0);
ALTER TABLE "RateLimitBucket" ADD CONSTRAINT "RateLimitBucket_count_check"
  CHECK ("count" > 0);

INSERT INTO "MigrationSentinel" ("id", "version", "updatedAt")
VALUES (1, '202608010001_initial', now());
