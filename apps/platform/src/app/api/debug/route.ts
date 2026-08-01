import { db } from "@/server/shared/db";

export async function GET() {
  try {
    const user = await db.adminUser.findUnique({ where: { email: "admin@test.com" } });
    return Response.json({ exists: !!user, envUrl: process.env.DATABASE_URL?.substring(0, 20) + "..." });
  } catch (err: any) {
    return Response.json({ error: err.message });
  }
}
