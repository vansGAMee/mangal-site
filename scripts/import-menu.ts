import "dotenv/config";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { applyMenuImport, MenuImportError, parseMenuImport } from "../apps/platform/src/server/catalog/menu-import";
import { db, disconnectDatabase } from "../apps/platform/src/server/shared/db";

async function main(): Promise<void> {
  const fileArg = argument("--file") ?? positionalFile();
  if (!fileArg) throw new Error("Usage: npm run import-menu -- --file ./menu.csv [--dry-run] [--update-existing]");
  const filePath = resolve(fileArg);
  const plan = parseMenuImport(basename(filePath), await readFile(filePath));
  const dryRun = process.argv.includes("--dry-run");
  const updateExisting = process.argv.includes("--update-existing");
  const result = await db.$transaction(
    (tx) => applyMenuImport(tx, plan, { dryRun, updateExisting }),
    { timeout: 60_000 },
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positionalFile(): string | undefined {
  return process.argv.slice(2).find((value) => !value.startsWith("--"));
}

main()
  .then(disconnectDatabase)
  .catch(async (error: unknown) => {
    if (error instanceof MenuImportError) {
      process.stderr.write(`${error.message}\n${error.issues.join("\n")}\n`);
    } else {
      process.stderr.write(`${error instanceof Error ? error.message : "Import failed"}\n`);
    }
    await disconnectDatabase();
    process.exitCode = 1;
  });
