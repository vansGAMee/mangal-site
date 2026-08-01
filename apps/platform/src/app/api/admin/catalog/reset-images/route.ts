import { validateAdminMutation } from "@/server/admin/auth";
import { db } from "@/server/shared/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Временно разрешаем всем, чтобы сбросить базу (можно убрать после использования)
    const updated = await db.product.updateMany({
      where: {
        imagePath: {
          startsWith: "data:image/"
        }
      },
      data: {
        imagePath: "/images/product-placeholder.svg"
      }
    });

    return NextResponse.json({ message: "Images reset successfully", count: updated.count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
