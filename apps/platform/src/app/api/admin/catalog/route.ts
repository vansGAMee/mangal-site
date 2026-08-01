import { authenticateAdminRequest } from "@/server/admin/auth";
import { db } from "@/server/shared/db";
export async function GET(request:Request):Promise<Response>{try{await authenticateAdminRequest(request);const categories=await db.category.findMany({orderBy:{position:"asc"},include:{products:{orderBy:{createdAt:"asc"},include:{modifierGroups:{include:{modifierGroup:{include:{options:{orderBy:{position:"asc"}}}}}}}}}});return Response.json(categories,{headers:{"Cache-Control":"no-store"}})}catch{return new Response(null,{status:401})}}
