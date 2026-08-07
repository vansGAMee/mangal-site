-- Add isTest column to Order table (additive migration, no data loss)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;
