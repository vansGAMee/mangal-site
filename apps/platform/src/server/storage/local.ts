import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { ImageStorage, ImageUpload, StoredAssetReference, StoredImage } from "./types";

export class LocalVolumeStorage implements ImageStorage {
  readonly driver = "LOCAL" as const;

  constructor(
    private readonly root: string,
    private readonly publicBaseUrl: string,
  ) {}

  async put(upload: ImageUpload, namespace: string): Promise<StoredImage> {
    const safeNamespace = safePathSegment(namespace);
    const objectKey = `${safeNamespace}/${randomUUID()}.${upload.extension}`;
    const target = resolveLocalMediaPath(this.root, objectKey);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(temporary, upload.buffer, { flag: "wx", mode: 0o640 });
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
    const publicUrl = this.publicBaseUrl.startsWith("http://") || this.publicBaseUrl.startsWith("https://")
      ? `${new URL(this.publicBaseUrl).origin}/uploads/${objectKey}`
      : `/uploads/${objectKey}`;
    return {
      driver: this.driver,
      objectKey,
      publicUrl,
    };
  }

  async delete(asset: StoredAssetReference): Promise<void> {
    await rm(resolveLocalMediaPath(this.root, asset.objectKey), { force: true });
  }
}

export function resolveLocalMediaPath(root: string, objectKey: string): string {
  const normalizedRoot = resolve(root);
  const segments = objectKey.split("/");
  if (!segments.length || segments.some((segment) => !/^[a-zA-Z0-9._-]+$/.test(segment) || segment === "." || segment === "..")) {
    throw new Error("invalid_media_object_key");
  }
  const target = resolve(normalizedRoot, ...segments);
  if (target !== normalizedRoot && !target.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error("invalid_media_object_key");
  }
  return target;
}

function safePathSegment(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!normalized) throw new Error("invalid_media_namespace");
  return normalized.slice(0, 80);
}
