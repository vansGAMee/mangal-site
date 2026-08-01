import { createHash } from "node:crypto";
import { db } from "../shared/db";

export async function consumeRateLimit(identity: string, scope: string, limit: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs * 2);
  const keyHash = createHash("sha256").update(`${scope}:${identity}:${windowStart.toISOString()}`).digest("hex");

  const bucket = await db.rateLimitBucket.upsert({
    where: { keyHash },
    create: { keyHash, count: 1, windowStart, expiresAt },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return bucket.count <= limit;
}
