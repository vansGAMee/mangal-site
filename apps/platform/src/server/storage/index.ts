import { runtimeEnv } from "../shared/env";
import { LocalVolumeStorage } from "./local";
import type { ImageStorage } from "./types";
import { VercelBlobStorage } from "./vercel-blob";

export function imageStorage(): ImageStorage {
  const env = runtimeEnv();
  return imageStorageForDriver(env.STORAGE_DRIVER === "vercel-blob" ? "VERCEL_BLOB" : "LOCAL");
}

export function imageStorageForDriver(driver: "LOCAL" | "VERCEL_BLOB"): ImageStorage {
  const env = runtimeEnv();
  if (driver === "VERCEL_BLOB") {
    if (!env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is required for vercel-blob storage");
    return new VercelBlobStorage(env.BLOB_READ_WRITE_TOKEN);
  }
  const root = env.LOCAL_MEDIA_ROOT ?? (env.NODE_ENV === "production" ? undefined : ".data/media");
  const publicBaseUrl = env.MEDIA_PUBLIC_BASE_URL ?? (env.NODE_ENV === "production" ? undefined : "http://localhost:3001");
  if (!root || !publicBaseUrl) {
    throw new Error("LOCAL_MEDIA_ROOT and MEDIA_PUBLIC_BASE_URL are required for local storage");
  }
  return new LocalVolumeStorage(root, publicBaseUrl);
}
