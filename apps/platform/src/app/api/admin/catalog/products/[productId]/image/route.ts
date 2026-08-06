import { validateAdminMutation } from "@/server/admin/auth";
import { db } from "@/server/shared/db";
import { NextResponse } from "next/server";

export async function POST(request: Request, props: { params: Promise<{ productId: string }> }) {
  try {
    await validateAdminMutation(request);
    const params = await props.params;
    const productId = params.productId;
    
    const formData = await request.formData();
    const file = formData.get("image") as File;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    await db.product.update({
      where: { id: productId },
      data: { imagePath: dataUrl },
    });

    return NextResponse.json({ url: dataUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
