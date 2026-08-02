import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";

async function main(): Promise<void> {
  const fixture = await readFile(resolve("tests/fixtures/public-catalog.json"));
  const server = createServer((request, response) => {
    if (request.url === "/api/public/catalog") {
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(fixture);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Unable to allocate fixture server port");
    const apiUrl = `http://127.0.0.1:${address.port}`;
    const npmEntrypoint = process.env.npm_execpath;
    if (!npmEntrypoint) throw new Error("npm_execpath is unavailable");
    await runNode(npmEntrypoint, ["run", "build:storefront"], {
      ...process.env,
      DOTENV_CONFIG_PATH: resolve("tests/fixtures/empty.env"),
      NODE_ENV: "production",
      PLATFORM_API_URL: apiUrl,
      NEXT_PUBLIC_PLATFORM_API_URL: apiUrl,
      NEXT_PUBLIC_MEDIA_BASE_URL: apiUrl,
      NEXT_PUBLIC_SITE_URL: "https://storefront-build.example.invalid",
      NEXT_PUBLIC_YANDEX_METRIKA_ID: "",
    });
  } finally {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  }
}

function runNode(entrypoint: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`Storefront build exited with ${code}`)));
  });
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Storefront build test failed"}\n`);
  process.exit(1);
});
