// Trigger build
import { db } from "@/server/shared/db";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function GET(request: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Vercel Blob token not found" }, { status: 400 });
    }

    const productsWithBase64 = await db.product.findMany({
      where: {
        imagePath: {
          startsWith: "data:image/"
        }
      }
    });

    if (productsWithBase64.length === 0) {
      return NextResponse.json({ message: "No images to migrate" });
    }

    let migratedCount = 0;
    let errors = [];

    for (const product of productsWithBase64) {
      try {
        // Extract base64 and mime type
        const match = product.imagePath.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!match) continue;
        
        const mimeType = match[1];
        const base64Data = match[2];
        if (!base64Data || !mimeType) continue;
        const buffer = Buffer.from(base64Data, "base64");
        
        // Get file extension
        const ext = mimeType.split("/")[1] || "jpg";
        const filename = `products/${product.id}.${ext}`;

        // Upload to Vercel Blob
        const blob = await put(filename, buffer, {
          access: "public",
          contentType: mimeType
        });

        // Update DB
        await db.product.update({
          where: { id: product.id },
          data: { imagePath: blob.url }
        });

        migratedCount++;
      } catch (err: any) {
        errors.push({ id: product.id, error: err.message });
      }
    }

    return NextResponse.json({ 
      message: "Migration complete", 
      migrated: migratedCount, 
      errors 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
