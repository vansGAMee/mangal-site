import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../../../generated/prisma/client";
import { runtimeEnv } from "./env";

const globalDb = globalThis as typeof globalThis & {
  mangalPrisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const env = runtimeEnv();
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    connectionTimeoutMillis: env.DATABASE_CONNECT_TIMEOUT_MS,
    idleTimeoutMillis: 30_000,
  });
  return new PrismaClient({ adapter });
}

export const db = globalDb.mangalPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalDb.mangalPrisma = db;

export async function disconnectDatabase(): Promise<void> {
  await db.$disconnect();
}
