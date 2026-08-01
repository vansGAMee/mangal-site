import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const windows1251 = new TextDecoder("windows-1251");
const utf8 = new TextDecoder("utf-8", { fatal: true });
const byteByCharacter = new Map();

for (let byte = 0; byte <= 255; byte += 1) {
  byteByCharacter.set(windows1251.decode(Uint8Array.of(byte)), byte);
}

const continuationCharacters = new Set(
  Array.from({ length: 64 }, (_, offset) =>
    windows1251.decode(Uint8Array.of(0x80 + offset)),
  ),
);

const roots = ["apps", "packages", "prisma", "tests", "docs", "scripts"];
const textExtensions = new Set([
  ".css",
  ".json",
  ".md",
  ".mjs",
  ".prisma",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const fix = process.argv.includes("--fix");
const candidates = [];

function mojibakeScore(value) {
  const characters = [...value];
  let score = 0;

  for (let index = 0; index < characters.length - 1; index += 1) {
    if (
      ["Р", "С", "В"].includes(characters[index]) &&
      continuationCharacters.has(characters[index + 1])
    ) {
      score += 1;
    }
  }

  return score;
}

function restoreUtf8(value) {
  const bytes = [];

  for (const character of value) {
    const byte = byteByCharacter.get(character);
    if (byte === undefined) return null;
    bytes.push(byte);
  }

  try {
    return utf8.decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

function inspect(path) {
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) inspect(join(path, entry));
    return;
  }

  if (!textExtensions.has(extname(path))) return;
  const source = readFileSync(path, "utf8");
  const before = mojibakeScore(source);
  if (before === 0) return;

  const restored = restoreUtf8(source);
  const after = restored === null ? before : mojibakeScore(restored);
  candidates.push({ path, before, after, fixable: restored !== null });

  if (fix && restored !== null && after < before) {
    writeFileSync(path, restored, "utf8");
  }
}

for (const root of roots) inspect(root);

if (candidates.length > 0) {
  for (const candidate of candidates) {
    console.error(
      `${candidate.path}: mojibake score ${candidate.before}; ` +
        (candidate.fixable ? `restored score ${candidate.after}` : "mixed encoding"),
    );
  }

  if (!fix || candidates.some((candidate) => !candidate.fixable)) {
    process.exitCode = 1;
  }
}
