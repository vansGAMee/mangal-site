import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

async function main(): Promise<void> {
  const databaseDirectory = await mkdtemp(join(tmpdir(), "mangal-productization-"));
  const port = await freePort();
  const password = "temporary-productization-test-only";
  const databaseName = "mangal_productization_test";
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
      DATABASE_POOL_MAX: "2",
      PERSONAL_DATA_LEGAL_BASIS: "CONTRACT",
      MFA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      CLIENT_ADMIN_PASSWORD: "Disposable-only-passphrase-27!",
    };

    await runNode("node_modules/prisma/build/index.js", ["migrate", "deploy"], environment);
    await runNode("node_modules/tsx/dist/cli.mjs", ["scripts/create-client.ts", "--config", "clients/example.client.json"], environment, true);
    await runNode("node_modules/tsx/dist/cli.mjs", ["scripts/import-menu.ts", "--file", "examples/menu-template.json", "--dry-run"], environment, true);

    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      await assertProvisionedState(client, { imports: "1" });
    } finally {
      await client.end();
    }

    await runNode("node_modules/tsx/dist/cli.mjs", ["scripts/import-menu.ts", "--file", "examples/menu-template.json"], environment, true);
    const verificationClient = new pg.Client({ connectionString: databaseUrl });
    await verificationClient.connect();
    try {
      await assertProvisionedState(verificationClient, { imports: "2" });
    } finally {
      await verificationClient.end();
    }

    const duplicateExitCode = await runNode(
      "node_modules/tsx/dist/cli.mjs",
      ["scripts/import-menu.ts", "--file", "examples/menu-template.json"],
      environment,
      true,
      true,
    );
    if (duplicateExitCode === 0) throw new Error("Duplicate import unexpectedly succeeded");
    process.stdout.write("Client generator, dry-run import, write import and duplicate-file guard passed.\n");
  } finally {
    await embedded.stop().catch(() => undefined);
    await rm(databaseDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function assertProvisionedState(client: pg.Client, expected: { imports: string }): Promise<void> {
  const result = await client.query<{
    profile: string;
    products: string;
    unpriced: string;
    admins: string;
    totp: string;
    recovery: string;
    imports: string;
    zones: string;
    routes: string;
    tax_system: string | null;
  }>(`
    SELECT
      (SELECT slug FROM "RestaurantProfile" WHERE id = 'singleton') AS profile,
      (SELECT count(*) FROM "Product") AS products,
      (SELECT count(*) FROM "Product" WHERE "requiresPriceConfirmation") AS unpriced,
      (SELECT count(*) FROM "AdminUser" WHERE role = 'ADMIN' AND "mfaRequired") AS admins,
      (SELECT count(*) FROM "AdminTotpCredential") AS totp,
      (SELECT count(*) FROM "AdminRecoveryCode") AS recovery,
      (SELECT count(*) FROM "CatalogImport") AS imports,
      (SELECT count(*) FROM "DeliveryZone") AS zones,
      (SELECT count(*) FROM "PaymentRouting") AS routes,
      (SELECT "taxSystemCode" FROM "StoreSettings" WHERE id = 'singleton') AS tax_system
  `);
  const row = result.rows[0];
  if (!row || row.profile !== "primer-kafe" || row.products !== "3" || row.unpriced !== "1" || row.admins !== "1" || row.totp !== "1" || row.recovery !== "10" || row.imports !== expected.imports || row.zones !== "0" || row.routes !== "0" || row.tax_system !== null) {
    throw new Error(`Unexpected productization state: ${JSON.stringify(row)}`);
  }
}

function runNode(
  entrypoint: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  suppressOutput = false,
  allowFailure = false,
): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve(entrypoint), ...args], {
      cwd: process.cwd(),
      env,
      stdio: suppressOutput ? ["ignore", "ignore", "inherit"] : "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      const exitCode = code ?? 1;
      if (!allowFailure && exitCode !== 0) reject(new Error(`${entrypoint} exited with ${exitCode}`));
      else resolvePromise(exitCode);
    });
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

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Productization integration test failed"}\n`);
  process.exit(1);
});
