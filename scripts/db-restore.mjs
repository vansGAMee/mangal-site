import "dotenv/config";
import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const connection = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connection) throw new Error("DIRECT_URL or DATABASE_URL is required");
const database = new URL(connection);
const databaseName = decodeURIComponent(database.pathname.slice(1));
const input = argument("--file");
const confirmation = argument("--confirm");
if (!input || confirmation !== databaseName) {
  throw new Error(`Usage: npm run db:restore -- --file ./backups/file.dump --confirm ${databaseName}`);
}
const inputFile = resolve(input);
await access(inputFile);
await run("pg_restore", [
  "--clean",
  "--if-exists",
  "--single-transaction",
  "--no-owner",
  "--no-privileges",
  `--dbname=${databaseName}`,
  inputFile,
], postgresEnvironment(database));

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function postgresEnvironment(url) {
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
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
