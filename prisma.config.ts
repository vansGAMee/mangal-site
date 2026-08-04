import "dotenv/config";
import { defineConfig } from "prisma/config";

const dbUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "postgresql://dummy:dummy@127.0.0.1:5432/dummy?schema=public";

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
