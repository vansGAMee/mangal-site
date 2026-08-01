import { authenticateAdminRequest, requireRole } from "@/server/admin/auth";
import { db } from "@/server/shared/db";
export async function GET(request:Request):Promise<Response>{try{const admin=await authenticateAdminRequest(request);requireRole(admin,["ADMIN"]);const events=await db.adminAuditLog.findMany({orderBy:{createdAt:"desc"},take:200,include:{adminUser:{select:{emailNormalized:true}}}});return Response.json(events,{headers:{"Cache-Control":"no-store"}})}catch{return new Response(null,{status:403})}}
