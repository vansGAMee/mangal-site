import "dotenv/config";
import { defineConfig } from "prisma/config";

const dbUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!dbUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL is required for Prisma commands");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: dbUrl,
    ...(process.env.SHADOW_DATABASE_URL?.trim() ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL } : {}),
  },
});
