import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalVolumeStorage, resolveLocalMediaPath } from "@platform/server/storage/local";
import { VercelBlobStorage } from "@platform/server/storage/vercel-blob";
import type { ImageUpload } from "@platform/server/storage/types";
import { ImageValidationError, validateImageFile } from "@platform/server/storage/validation";

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
  0, 0, 0, 2, 0, 0, 0, 3,
]);

describe("image storage", () => {
  it("validates MIME against magic bytes and extracts PNG dimensions", async () => {
    const upload = await validateImageFile(fileLike("image/png", png), 1024);
    expect(upload).toMatchObject({ mimeType: "image/png", extension: "png", width: 2, height: 3 });
    await expect(validateImageFile(fileLike("image/jpeg", png), 1024)).rejects.toBeInstanceOf(ImageValidationError);
  });

  it("writes and deletes an immutable local-volume object", async () => {
    const root = await mkdtemp(join(tmpdir(), "mangal-media-"));
    temporaryDirectories.push(root);
    const storage = new LocalVolumeStorage(root, "/uploads");
    const upload = await validateImageFile(fileLike("image/png", png), 1024);
    const stored = await storage.put(upload, "products/demo");
    expect(stored.objectKey).toMatch(/^products-demo\/[0-9a-f-]+\.png$/);
    expect(stored.publicUrl).toMatch(/^\/uploads\/products-demo\/[0-9a-f-]+\.png$/);
    expect(await readFile(resolveLocalMediaPath(root, stored.objectKey))).toEqual(png);
    await storage.delete(stored);
    await expect(readFile(resolveLocalMediaPath(root, stored.objectKey))).rejects.toThrow();
    expect(() => resolveLocalMediaPath(root, "../secret")).toThrow("invalid_media_object_key");
  });

  it("uses Vercel Blob through an injectable adapter without a network call", async () => {
    const put = vi.fn(async (key: string) => ({ url: `https://blob.example.test/${key}` }));
    const del = vi.fn(async () => undefined);
    const storage = new VercelBlobStorage("test-token", put, del);
    const stored = await storage.put(fakeUpload(), "products");
    expect(put).toHaveBeenCalledOnce();
    expect(put.mock.calls[0]?.[2]).toMatchObject({ access: "public", token: "test-token", addRandomSuffix: false });
    await storage.delete(stored);
    expect(del).toHaveBeenCalledWith(stored.publicUrl, { token: "test-token" });
  });
});

function fileLike(type: string, buffer: Buffer): Pick<File, "type" | "size" | "arrayBuffer"> {
  return { type, size: buffer.byteLength, arrayBuffer: async () => Uint8Array.from(buffer).buffer };
}

function fakeUpload(): ImageUpload {
  return {
    buffer: png,
    mimeType: "image/png",
    extension: "png",
    byteSize: png.byteLength,
    sha256: "0".repeat(64),
    width: 2,
    height: 3,
  };
}
