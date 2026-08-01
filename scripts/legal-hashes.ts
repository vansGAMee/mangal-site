import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const documents = {
  LEGAL_PD_SHA256: "docs/legal/pd-v1.md",
  LEGAL_MARKETING_SHA256: "docs/legal/marketing-v1.md",
  LEGAL_COOKIE_SHA256: "docs/legal/cookie-v1.md",
  LEGAL_OFFER_SHA256: "docs/legal/offer-v1.md",
  LEGAL_TERMS_SHA256: "docs/legal/terms-v1.md",
};

async function main(): Promise<void> {
  for (const [name, path] of Object.entries(documents)) {
    const hash = createHash("sha256").update(await readFile(path)).digest("hex");
    process.stdout.write(`${name}=${hash}\n`);
  }
}

void main();
