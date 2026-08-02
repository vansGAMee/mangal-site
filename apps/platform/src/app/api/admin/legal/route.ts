import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { authenticateAdminRequest, consumeRoutingReauth, requireRole, validateAdminMutation } from "@/server/admin/auth";
import { readJsonBody, requestId } from "@/server/security/http";
import { db } from "@/server/shared/db";

const Schema = z.object({ id: z.string().uuid(), approved: z.boolean(), nonce: z.string().min(20) });
const legalRoot = resolve(process.cwd(), "docs", "legal");
const legalFiles: Record<string, string> = {
  "pd-v1": "pd-v1.md",
  "marketing-v1": "marketing-v1.md",
  "cookie-v1": "cookie-v1.md",
  "offer-v1": "offer-v1.md",
  "terms-v1": "terms-v1.md",
};
const expectedHashes: Record<string, string | undefined> = {
  "pd-v1": process.env.LEGAL_PD_SHA256,
  "marketing-v1": process.env.LEGAL_MARKETING_SHA256,
  "cookie-v1": process.env.LEGAL_COOKIE_SHA256,
  "offer-v1": process.env.LEGAL_OFFER_SHA256,
  "terms-v1": process.env.LEGAL_TERMS_SHA256,
};

export async function GET(request: Request): Promise<Response> {
  try {
    const admin = await authenticateAdminRequest(request);
    requireRole(admin, ["ADMIN"]);
    return Response.json(await db.legalDocumentVersion.findMany({ orderBy: { createdAt: "desc" } }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 403 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const admin = await validateAdminMutation(request);
    requireRole(admin, ["ADMIN"]);
    const parsed = Schema.safeParse(await readJsonBody(request));
    if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
    await consumeRoutingReauth(admin, parsed.data.nonce);
    const document = await db.legalDocumentVersion.findUnique({ where: { id: parsed.data.id } });
    if (!document) return new Response(null, { status: 404 });

    const legalFile = legalFiles[document.version];
    if (!legalFile) return Response.json({ error: "unsupported_legal_version" }, { status: 409 });
    const fileHash = createHash("sha256").update(await readFile(resolve(legalRoot, legalFile))).digest("hex");
    if (parsed.data.approved && (
      fileHash !== document.contentSha256
      || fileHash !== expectedHashes[document.version]
      || process.env.LEGAL_DOCS_APPROVED !== "true"
    )) return Response.json({ error: "legal_hash_not_confirmed" }, { status: 409 });

    await db.$transaction([
      db.legalDocumentVersion.update({
        where: { id: document.id },
        data: { approved: parsed.data.approved, activeFrom: parsed.data.approved ? new Date() : null },
      }),
      db.adminAuditLog.create({
        data: {
          adminUserId: admin.id,
          action: parsed.data.approved ? "LEGAL_DOCUMENT_APPROVED" : "LEGAL_DOCUMENT_REVOKED",
          targetType: "LegalDocumentVersion",
          targetId: document.id,
          metadata: { version: document.version, contentSha256: document.contentSha256 },
          requestId: id,
        },
      }),
    ]);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 403 });
  }
}
