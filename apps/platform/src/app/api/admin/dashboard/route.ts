import { authenticateAdminRequest } from "@/server/admin/auth";
import { db } from "@/server/shared/db";

export async function GET(request: Request): Promise<Response> {
  try {
    const admin = await authenticateAdminRequest(request);
    const [orders, unpriced, zones, routes, settings, unknown, reconciliation, refunds] = await Promise.all([
      db.order.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, publicId: true, paymentStatus: true, fulfillmentStatus: true, totalKopecks: true, version: true, createdAt: true } }),
      db.product.count({ where: { requiresPriceConfirmation: true } }),
      db.deliveryZone.count({ where: { isActive: true } }),
      db.paymentRouting.findMany(),
      db.storeSettings.findUnique({ where: { id: "singleton" } }),
      db.paymentAttempt.count({ where: { status: "UNKNOWN" } }),
      db.paymentReconciliationTask.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
      db.refund.count({ where: { status: { in: ["UNKNOWN", "REVIEW_REQUIRED"] } } }),
    ]);
    const fiscalMissing = await db.product.count({ where: { isOrderable: true, OR: [{ fiscalVatCode: null }, { fiscalPaymentSubject: null }, { fiscalPaymentMode: null }, { fiscalMeasure: null }] } });
    return Response.json({ admin, orders, warnings: { unpriced, noDeliveryZones: zones === 0, paymentRoutingIncomplete: routes.length !== 2 || routes.some((route) => !route.isActive), missingFiscal: !settings?.taxSystemCode || fiscalMissing > 0, encryptionKeyMissing: !process.env.PII_KEY_RING_JSON, unknown, reconciliation, stuckRefunds: refunds, businessIdentityMissing: !process.env.BUSINESS_INN || !process.env.BUSINESS_REGISTRATION_NUMBER } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return new Response(null, { status: 401 }); }
}
