import { z } from "zod";
import { AdminAuthError, validateAdminMutation } from "@/server/admin/auth";
import { logger } from "@/server/observability/logger";
import { BodyTooLargeError, readLimitedBytes, requestId } from "@/server/security/http";
import { db } from "@/server/shared/db";
import { runtimeEnv } from "@/server/shared/env";
import { imageStorage } from "@/server/storage";
import { deleteMediaAsset } from "@/server/storage/lifecycle";
import type { StoredImage } from "@/server/storage/types";
import { ImageValidationError, validateImageFile } from "@/server/storage/validation";

const VersionSchema = z.coerce.number().int().positive();

export async function POST(request: Request, context: { params: Promise<{ productId: string }> }): Promise<Response> {
  const id = requestId(request);
  let uploaded: StoredImage | null = null;
  let storage: ReturnType<typeof imageStorage> | null = null;
  try {
    const admin = await validateAdminMutation(request);
    const env = runtimeEnv();
    const { productId } = await context.params;
    const form = await limitedFormData(request, env.IMAGE_MAX_BYTES + 256 * 1024);
    const file = form.get("image");
    const version = VersionSchema.safeParse(form.get("version"));
    if (!(file instanceof File) || !version.success) {
      return Response.json({ error: "validation", requestId: id }, { status: 400 });
    }
    const image = await validateImageFile(file, env.IMAGE_MAX_BYTES);
    storage = imageStorage();
    uploaded = await storage.put(image, `products-${productId}`);

    const result = await db.$transaction(async (tx) => {
      const current = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          version: true,
          imageAsset: {
            select: { id: true },
          },
        },
      });
      if (!current) return { status: "not_found" as const, oldAssetId: null };
      if (current.version !== version.data) return { status: "version_conflict" as const, oldAssetId: null };

      const media = await tx.mediaAsset.create({
        data: {
          storageDriver: uploaded!.driver,
          objectKey: uploaded!.objectKey,
          publicUrl: uploaded!.publicUrl,
          mimeType: image.mimeType,
          byteSize: image.byteSize,
          width: image.width,
          height: image.height,
          sha256: image.sha256,
          altText: null,
        },
      });
      const changed = await tx.product.updateMany({
        where: { id: productId, version: version.data },
        data: { imageAssetId: media.id, imagePath: media.publicUrl, version: { increment: 1 } },
      });
      if (!changed.count) throw new Error("version_conflict");
      await tx.adminAuditLog.create({
        data: {
          adminUserId: admin.id,
          action: "PRODUCT_IMAGE_REPLACED",
          targetType: "Product",
          targetId: productId,
          metadata: { mediaAssetId: media.id, previousMediaAssetId: current.imageAsset?.id ?? null },
          requestId: id,
        },
      });
      return { status: "updated" as const, oldAssetId: current.imageAsset?.id ?? null, media };
    });

    if (result.status !== "updated") {
      await storage.delete(uploaded);
      uploaded = null;
      return new Response(null, { status: result.status === "not_found" ? 404 : 409 });
    }
    uploaded = null;
    if (result.oldAssetId) {
      try {
        await deleteMediaAsset(result.oldAssetId);
      } catch {
        await db.outboxEvent.create({
          data: {
            type: "DELETE_MEDIA_ASSET",
            aggregateType: "MediaAsset",
            aggregateId: result.oldAssetId,
            payload: { mediaAssetId: result.oldAssetId },
          },
        });
      }
    }
    return Response.json({ url: result.media.publicUrl, mediaAssetId: result.media.id });
  } catch (error) {
    if (uploaded && storage) await storage.delete(uploaded).catch(() => undefined);
    if (error instanceof AdminAuthError) return Response.json({ error: "forbidden", requestId: id }, { status: 403 });
    if (error instanceof BodyTooLargeError) return Response.json({ error: "file_too_large", requestId: id }, { status: 413 });
    if (error instanceof ImageValidationError) {
      return Response.json({ error: error.code, requestId: id }, { status: error.code === "file_too_large" ? 413 : 415 });
    }
    logger.warn({ requestId: id, code: error instanceof Error ? error.name : "unknown_error" }, "product image upload failed");
    return Response.json({ error: "upload_failed", requestId: id }, { status: 500 });
  }
}

async function limitedFormData(request: Request, limit: number): Promise<FormData> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) throw new ImageValidationError("unsupported_mime");
  const bytes = await readLimitedBytes(request, limit);
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, { headers: { "Content-Type": contentType } }).formData();
}
