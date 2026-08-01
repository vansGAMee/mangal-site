import { z } from "zod";
import { requirePermission, validateAdminMutation } from "@/server/admin/auth";
import { requestOrderCancellation, OrderMutationError } from "@/server/orders/cancel";
import { requestId } from "@/server/security/http";

const Schema = z.object({ version: z.number().int().positive(), reason: z.string().trim().min(3).max(500) });
export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }): Promise<Response> {
  const id = requestId(request);
  try {
    const admin = await validateAdminMutation(request); requirePermission(admin, "REFUND_ORDER");
    const parsed = Schema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
    const { orderId } = await context.params;
    const result = await requestOrderCancellation({ orderId, ...parsed.data, admin, requestId: id });
    return Response.json(result, { status: result.asynchronous ? 202 : 200 });
  } catch (error) {
    if (error instanceof OrderMutationError) return Response.json({ error: error.code }, { status: error.code === "not_found" ? 404 : 409 });
    return new Response(null, { status: 403 });
  }
}
