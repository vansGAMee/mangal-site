import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const connection = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connection) throw new Error("DIRECT_URL or DATABASE_URL is required");
const database = new URL(connection);
const outputDirectory = resolve(argument("--output") ?? "backups");
await mkdir(outputDirectory, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputFile = resolve(outputDirectory, `mangal-${timestamp}.dump`);

await run("pg_dump", [
  "--format=custom",
  "--compress=9",
  "--no-owner",
  "--no-privileges",
  `--file=${outputFile}`,
], postgresEnvironment(database));
process.stdout.write(`${outputFile}\n`);

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function postgresEnvironment(url) {
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get("sslmode") ?? process.env.PGSSLMODE ?? "prefer",
  };
}

function run(command, args, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}`)));
  });
}
