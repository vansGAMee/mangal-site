export type ImageUpload = {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  extension: "jpg" | "png" | "webp" | "avif";
  byteSize: number;
  sha256: string;
  width: number | null;
  height: number | null;
};

export type StoredImage = {
  driver: "LOCAL" | "VERCEL_BLOB";
  objectKey: string;
  publicUrl: string;
};

export type StoredAssetReference = {
  objectKey: string;
  publicUrl: string;
};

export interface ImageStorage {
  readonly driver: StoredImage["driver"];
  put(upload: ImageUpload, namespace: string): Promise<StoredImage>;
  delete(asset: StoredAssetReference): Promise<void>;
}
