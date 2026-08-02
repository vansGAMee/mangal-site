import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

async function main(): Promise<void> {
  const databaseDirectory = await mkdtemp(join(tmpdir(), "mangal-postgres-"));
  const port = await freePort();
  const password = "temporary-migration-test-only";
  const databaseName = "mangal_clean_migration";
  const embedded = new EmbeddedPostgres({
    databaseDir: databaseDirectory,
    user: "postgres",
    password,
    port,
    persistent: false,
    initdbFlags: ["--encoding=UTF8"],
    onLog: () => undefined,
    onError: (error) => process.stderr.write(`${String(error)}\n`),
  });

  try {
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase(databaseName);
  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/${databaseName}`;
  const environment = {
    ...process.env,
    DOTENV_CONFIG_PATH: resolve("tests/fixtures/empty.env"),
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    PERSONAL_DATA_LEGAL_BASIS: "CONTRACT",
  };
  await runNode("node_modules/prisma/build/index.js", ["migrate", "deploy"], environment);
  await runNode("node_modules/prisma/build/index.js", ["validate"], environment);
  await runNode("node_modules/tsx/dist/cli.mjs", ["prisma/seed.ts"], environment);
  await runNode("node_modules/tsx/dist/cli.mjs", ["prisma/seed.ts"], environment);

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<{
      products: string;
      unpriced: string;
      zones: string;
      hours: string;
      routes: string;
      legal: string;
      fiscal: string;
      sentinel: string;
    }>(`
      SELECT
        (SELECT count(*) FROM "Product") AS products,
        (SELECT count(*) FROM "Product" WHERE "requiresPriceConfirmation") AS unpriced,
        (SELECT count(*) FROM "DeliveryZone") AS zones,
        (SELECT count(*) FROM "OperatingHours") AS hours,
        (SELECT count(*) FROM "PaymentRouting") AS routes,
        (SELECT count(*) FROM "LegalDocumentVersion") AS legal,
        (SELECT count(*) FROM "Product" WHERE "fiscalVatCode" IS NOT NULL) AS fiscal,
        (SELECT version FROM "MigrationSentinel" WHERE id = 1) AS sentinel
    `);
    const row = result.rows[0];
    if (!row || row.products !== "33" || row.unpriced !== "2" || row.zones !== "0" || row.hours !== "0" || row.routes !== "0" || row.legal !== "5" || row.fiscal !== "0" || row.sentinel !== "202608020001_productization") {
      throw new Error(`Unexpected clean seed state: ${JSON.stringify(row)}`);
    }
  } finally {
    await client.end();
  }
  await runNode("node_modules/prisma/build/index.js", ["migrate", "status"], environment);
    process.stdout.write("Clean migration and repeatable production-safe seed passed.\n");
  } finally {
    await embedded.stop().catch(() => undefined);
    await rm(databaseDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Clean migration test failed"}\n`);
  process.exit(1);
});

function runNode(entrypoint: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve(entrypoint), ...args], {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${entrypoint} exited with ${code}`)));
  });
}

function freePort(): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Unable to allocate a test port"));
      server.close((error) => error ? reject(error) : resolvePromise(address.port));
    });
  });
}
