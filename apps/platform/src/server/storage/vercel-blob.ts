import { del as vercelDelete, put as vercelPut } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import type { ImageStorage, ImageUpload, StoredAssetReference, StoredImage } from "./types";

type PutFunction = (
  pathname: string,
  body: Buffer,
  options: {
    access: "public";
    addRandomSuffix: false;
    contentType: string;
    token: string;
  },
) => Promise<{ url: string }>;
type DeleteFunction = (url: string, options: { token: string }) => Promise<void>;

export class VercelBlobStorage implements ImageStorage {
  readonly driver = "VERCEL_BLOB" as const;

  constructor(
    private readonly token: string,
    private readonly putBlob: PutFunction = vercelPut as PutFunction,
    private readonly deleteBlob: DeleteFunction = vercelDelete as DeleteFunction,
  ) {}

  async put(upload: ImageUpload, namespace: string): Promise<StoredImage> {
    const safeNamespace = namespace.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 80) || "images";
    const objectKey = `${safeNamespace}/${randomUUID()}.${upload.extension}`;
    const result = await this.putBlob(objectKey, upload.buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: upload.mimeType,
      token: this.token,
    });
    return { driver: this.driver, objectKey, publicUrl: result.url };
  }

  async delete(asset: StoredAssetReference): Promise<void> {
    await this.deleteBlob(asset.publicUrl, { token: this.token });
  }
}
