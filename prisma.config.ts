import { defineConfig, env } from "prisma/config";

const dbUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "postgresql://postgres:postgres@localhost:5432/mangal_dev";

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
