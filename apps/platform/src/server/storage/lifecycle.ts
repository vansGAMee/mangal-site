import { db } from "../shared/db";
import { imageStorageForDriver } from "./index";

export async function deleteMediaAsset(mediaAssetId: string): Promise<void> {
  const asset = await db.mediaAsset.findUnique({ where: { id: mediaAssetId } });
  if (!asset || asset.deletedAt) return;
  await imageStorageForDriver(asset.storageDriver).delete({
    objectKey: asset.objectKey,
    publicUrl: asset.publicUrl,
  });
  await db.mediaAsset.updateMany({
    where: { id: asset.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}
