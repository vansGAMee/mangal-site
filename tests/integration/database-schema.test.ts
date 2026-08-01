import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
const enabled=Boolean(process.env.TEST_DATABASE_URL);
describe.skipIf(!enabled)("clean PostgreSQL migration",()=>{it("declares hard SQL checks and replay uniqueness",async()=>{const sql=await readFile("prisma/migrations/202608010001_initial/migration.sql","utf8");expect(sql).toContain("Product_pricing_shape_check");expect(sql).toContain('CREATE UNIQUE INDEX "PaymentWebhookEvent_fingerprint_key"');expect(sql).toContain('CREATE UNIQUE INDEX "Order_checkoutId_key"');});});
