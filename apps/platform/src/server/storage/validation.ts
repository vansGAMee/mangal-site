import { createHash } from "node:crypto";
import type { ImageUpload } from "./types";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export class ImageValidationError extends Error {
  constructor(readonly code: "missing_file" | "file_too_large" | "unsupported_mime" | "signature_mismatch") {
    super(code);
  }
}

export async function validateImageFile(
  file: Pick<File, "type" | "size" | "arrayBuffer">,
  maxBytes: number,
): Promise<ImageUpload> {
  if (!file || file.size <= 0) throw new ImageValidationError("missing_file");
  if (file.size > maxBytes) throw new ImageValidationError("file_too_large");
  if (!allowedMimeTypes.has(file.type)) throw new ImageValidationError("unsupported_mime");

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength !== file.size || !matchesSignature(buffer, file.type)) {
    throw new ImageValidationError("signature_mismatch");
  }
  const dimensions = pngDimensions(buffer, file.type);
  return {
    buffer,
    mimeType: file.type as ImageUpload["mimeType"],
    extension: extensionFor(file.type),
    byteSize: buffer.byteLength,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
}

function extensionFor(mimeType: string): ImageUpload["extension"] {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "avif";
}

function matchesSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/webp") {
    return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  if (mimeType === "image/avif") {
    if (buffer.length < 16 || buffer.toString("ascii", 4, 8) !== "ftyp") return false;
    const brand = buffer.toString("ascii", 8, 12);
    return brand === "avif" || brand === "avis" || buffer.toString("ascii", 8, Math.min(buffer.length, 32)).includes("avif");
  }
  return false;
}

function pngDimensions(buffer: Buffer, mimeType: string): { width: number; height: number } | null {
  if (mimeType !== "image/png" || buffer.length < 24) return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}
