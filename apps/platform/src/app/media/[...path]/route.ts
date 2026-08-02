import { readFile, stat } from "node:fs/promises";
import { runtimeEnv } from "@/server/shared/env";
import { resolveLocalMediaPath } from "@/server/storage/local";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const env = runtimeEnv();
  if (env.STORAGE_DRIVER !== "local" || !env.LOCAL_MEDIA_ROOT) return new Response(null, { status: 404 });
  try {
    const { path } = await context.params;
    const objectKey = path.join("/");
    const filePath = resolveLocalMediaPath(env.LOCAL_MEDIA_ROOT, objectKey);
    const info = await stat(filePath);
    if (!info.isFile()) return new Response(null, { status: 404 });
    const contents = await readFile(filePath);
    return new Response(Uint8Array.from(contents).buffer, {
      headers: {
        "Content-Type": mimeType(filePath),
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

function mimeType(path: string): string {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}
