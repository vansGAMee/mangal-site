import { validateAdminMutation } from "@/server/admin/auth";
import { db } from "@/server/shared/db";
import { put } from "@vercel/blob";
import { NextResponse } from "next";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await validateAdminMutation(request);
    const params = await props.params;
    
    const formData = await request.formData();
    const file = formData.get("image") as File;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const blob = await put(`products/${params.id}-${file.name}`, file, {
      access: "public",
    });

    await db.product.update({
      where: { id: params.id },
      data: { imagePath: blob.url },
    });

    return NextResponse.json({ url: blob.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
