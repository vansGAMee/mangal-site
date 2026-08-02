import { z } from "zod";
import { AdminAuthError, requireRole, validateAdminMutation } from "@/server/admin/auth";
import { logger } from "@/server/observability/logger";
import { BodyTooLargeError, readLimitedBytes, requestId } from "@/server/security/http";
import { db } from "@/server/shared/db";
import { runtimeEnv } from "@/server/shared/env";
import { imageStorage } from "@/server/storage";
import { deleteMediaAsset } from "@/server/storage/lifecycle";
import type { StoredImage } from "@/server/storage/types";
import { ImageValidationError, validateImageFile } from "@/server/storage/validation";

const KindSchema = z.enum(["logo", "favicon", "hero"]);
const VersionSchema = z.coerce.number().int().positive();

export async function POST(request: Request): Promise<Response> {
  const id = requestId(request);
  let uploaded: StoredImage | null = null;
  let storage: ReturnType<typeof imageStorage> | null = null;
  try {
    const admin = await validateAdminMutation(request);
    requireRole(admin, ["ADMIN"]);
    const env = runtimeEnv();
    const form = await limitedFormData(request, env.IMAGE_MAX_BYTES + 256 * 1024);
    const file = form.get("image");
    const kind = KindSchema.safeParse(form.get("kind"));
    const version = VersionSchema.safeParse(form.get("version"));
    if (!(file instanceof File) || !kind.success || !version.success) {
      return Response.json({ error: "validation", requestId: id }, { status: 400 });
    }
    const image = await validateImageFile(file, env.IMAGE_MAX_BYTES);
    storage = imageStorage();
    uploaded = await storage.put(image, `restaurant-${kind.data}`);

    const outcome = await db.$transaction(async (tx) => {
      const current = await tx.restaurantProfile.findUnique({ where: { id: "singleton" } });
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
          altText: kind.data === "hero" ? `Обложка ${current.name}` : null,
        },
      });
      const data = kind.data === "logo"
        ? { logoAssetId: media.id, logoPath: media.publicUrl }
        : kind.data === "favicon"
          ? { faviconAssetId: media.id, faviconPath: media.publicUrl }
          : { heroImageAssetId: media.id, heroImagePath: media.publicUrl };
      const changed = await tx.restaurantProfile.updateMany({
        where: { id: "singleton", version: version.data },
        data: { ...data, version: { increment: 1 } },
      });
      if (!changed.count) throw new Error("version_conflict");
      const oldAssetId = kind.data === "logo"
        ? current.logoAssetId
        : kind.data === "favicon"
          ? current.faviconAssetId
          : current.heroImageAssetId;
      await tx.adminAuditLog.create({
        data: {
          adminUserId: admin.id,
          action: "RESTAURANT_MEDIA_REPLACED",
          targetType: "RestaurantProfile",
          targetId: "singleton",
          metadata: { kind: kind.data, mediaAssetId: media.id, previousMediaAssetId: oldAssetId },
          requestId: id,
        },
      });
      return { status: "updated" as const, media, oldAssetId };
    });

    if (outcome.status !== "updated") {
      await storage.delete(uploaded);
      uploaded = null;
      return new Response(null, { status: outcome.status === "not_found" ? 404 : 409 });
    }
    uploaded = null;
    if (outcome.oldAssetId) {
      try {
        await deleteMediaAsset(outcome.oldAssetId);
      } catch {
        await db.outboxEvent.create({
          data: {
            type: "DELETE_MEDIA_ASSET",
            aggregateType: "MediaAsset",
            aggregateId: outcome.oldAssetId,
            payload: { mediaAssetId: outcome.oldAssetId },
          },
        });
      }
    }
    return Response.json({ url: outcome.media.publicUrl, version: version.data + 1 });
  } catch (error) {
    if (uploaded && storage) await storage.delete(uploaded).catch(() => undefined);
    if (error instanceof AdminAuthError) return Response.json({ error: "forbidden", requestId: id }, { status: 403 });
    if (error instanceof BodyTooLargeError) return Response.json({ error: "file_too_large", requestId: id }, { status: 413 });
    if (error instanceof ImageValidationError) {
      return Response.json({ error: error.code, requestId: id }, { status: error.code === "file_too_large" ? 413 : 415 });
    }
    logger.warn({ requestId: id, code: error instanceof Error ? error.name : "unknown_error" }, "restaurant media upload failed");
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
