import { createHmac, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import * as OTPAuth from "otpauth";
import { db } from "../shared/db";
import { associatedData, PiiCipher, secureTokenEquals } from "../crypto/envelope";
import { runtimeEnv } from "../shared/env";

export const ADMIN_COOKIE = process.env.NODE_ENV === "production" ? "__Host-mangal_admin" : "mangal_admin_dev";
export const CSRF_COOKIE = process.env.NODE_ENV === "production" ? "__Host-mangal_csrf" : "mangal_csrf_dev";
const SESSION_IDLE_MS = 30 * 60_000;
const SESSION_ABSOLUTE_MS = 12 * 60 * 60_000;

export type AuthenticatedAdmin = {
  id: string;
  sessionId: string;
  email: string;
  role: "ADMIN" | "MANAGER";
  permissions: string[];
};

export class AdminAuthError extends Error {
  constructor(readonly code: "invalid_credentials" | "locked" | "mfa_required" | "session_expired" | "csrf" | "origin") { super(code); }
}

export async function hashAdminPassword(password: string): Promise<string> {
  return hash(password, { algorithm: 2, memoryCost: 65_536, timeCost: 3, parallelism: 1, outputLen: 32 });
}

export async function loginAdmin(email: string, password: string, mfaCode: string | undefined): Promise<{ admin: AuthenticatedAdmin; token: string; csrfToken: string }> {
  const emailNormalized = email.trim().toLowerCase();
  const user = await db.adminUser.findUnique({
    where: { emailNormalized },
    include: { totpCredential: true, recoveryCodes: { where: { usedAt: null } }, permissions: true },
  });
  if (!user || !user.isActive) throw new AdminAuthError("invalid_credentials");
  if (user.lockedUntil && user.lockedUntil > new Date()) throw new AdminAuthError("locked");
  if (!(await verify(user.passwordHash, password))) {
    const failures = user.failedLoginCount + 1;
    await db.adminUser.update({ where: { id: user.id }, data: { failedLoginCount: failures, ...(failures >= 5 ? { lockedUntil: new Date(Date.now() + 15 * 60_000) } : {}) } });
    throw new AdminAuthError("invalid_credentials");
  }
  if (user.role === "ADMIN" || user.mfaRequired) {
    if (!mfaCode || !user.totpCredential) throw new AdminAuthError("mfa_required");
    const usedTotp = await verifyTotp(user.id, user.totpCredential, mfaCode);
    if (!usedTotp) {
      const recovery = await findRecoveryCode(user.recoveryCodes, mfaCode);
      if (!recovery) throw new AdminAuthError("invalid_credentials");
      await db.adminRecoveryCode.update({ where: { id: recovery.id }, data: { usedAt: new Date() } });
    }
  }
  await db.adminUser.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(24).toString("base64url");
  const now = Date.now();
  const session = await db.adminSession.create({
    data: {
      adminUserId: user.id,
      tokenHash: sessionHash(token),
      csrfTokenHash: csrfHash(csrfToken),
      idleExpiresAt: new Date(now + SESSION_IDLE_MS),
      absoluteExpiresAt: new Date(now + SESSION_ABSOLUTE_MS),
    },
  });
  return {
    admin: { id: user.id, sessionId: session.id, email: user.emailNormalized, role: user.role, permissions: user.permissions.map((permission) => permission.code) },
    token,
    csrfToken,
  };
}

export async function authenticateAdminRequest(request: Request): Promise<AuthenticatedAdmin> {
  const token = cookieValue(request, ADMIN_COOKIE);
  if (!token) throw new AdminAuthError("session_expired");
  const session = await db.adminSession.findUnique({
    where: { tokenHash: sessionHash(token) },
    include: { adminUser: { include: { permissions: true } } },
  });
  const now = new Date();
  if (!session || session.revokedAt || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now || !session.adminUser.isActive) {
    if (session && !session.revokedAt) await db.adminSession.update({ where: { id: session.id }, data: { revokedAt: now } });
    throw new AdminAuthError("session_expired");
  }
  await db.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: now, idleExpiresAt: new Date(Math.min(now.getTime() + SESSION_IDLE_MS, session.absoluteExpiresAt.getTime())) } });
  return { id: session.adminUser.id, sessionId: session.id, email: session.adminUser.emailNormalized, role: session.adminUser.role, permissions: session.adminUser.permissions.map((permission) => permission.code) };
}

export async function validateAdminMutation(request: Request): Promise<AuthenticatedAdmin> {
  const configuredOrigin = process.env.ADMIN_BASE_URL;
  if (!configuredOrigin || request.headers.get("origin") !== new URL(configuredOrigin).origin) throw new AdminAuthError("origin");
  const admin = await authenticateAdminRequest(request);
  const csrfToken = request.headers.get("x-csrf-token");
  const csrfCookie = cookieValue(request, CSRF_COOKIE);
  if (!csrfToken || !csrfCookie || !secureTokenEquals(csrfToken, csrfCookie)) throw new AdminAuthError("csrf");
  const session = await db.adminSession.findUniqueOrThrow({ where: { id: admin.sessionId }, select: { csrfTokenHash: true } });
  if (!secureTokenEquals(session.csrfTokenHash, csrfHash(csrfToken))) throw new AdminAuthError("csrf");
  return admin;
}

export function requireRole(admin: AuthenticatedAdmin, roles: Array<AuthenticatedAdmin["role"]>): void {
  if (!roles.includes(admin.role)) throw new AdminAuthError("invalid_credentials");
}

export function requirePermission(admin: AuthenticatedAdmin, permission: string): void {
  if (!admin.permissions.includes(permission)) throw new AdminAuthError("invalid_credentials");
}

export async function revokeSession(request: Request): Promise<void> {
  const token = cookieValue(request, ADMIN_COOKIE);
  if (token) await db.adminSession.updateMany({ where: { tokenHash: sessionHash(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function grantRoutingReauth(admin: AuthenticatedAdmin, password: string, totpCode: string): Promise<string> {
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id }, include: { totpCredential: true } });
  if (!(await verify(user.passwordHash, password)) || !user.totpCredential || !(await verifyTotp(user.id, user.totpCredential, totpCode))) {
    throw new AdminAuthError("invalid_credentials");
  }
  const nonce = randomBytes(24).toString("base64url");
  await db.adminSession.update({ where: { id: admin.sessionId }, data: { reauthUntil: new Date(Date.now() + 5 * 60_000), reauthNonceHash: sessionHash(nonce) } });
  return nonce;
}

export async function consumeRoutingReauth(admin: AuthenticatedAdmin, nonce: string): Promise<void> {
  const session = await db.adminSession.findUniqueOrThrow({ where: { id: admin.sessionId } });
  if (!session.reauthUntil || session.reauthUntil <= new Date() || !session.reauthNonceHash || !secureTokenEquals(session.reauthNonceHash, sessionHash(nonce))) {
    throw new AdminAuthError("invalid_credentials");
  }
  await db.adminSession.update({ where: { id: session.id }, data: { reauthUntil: null, reauthNonceHash: null } });
}

export function sessionCookies(token: string, csrfToken: string): string[] {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_ABSOLUTE_MS / 1000}${secure}`,
    `${CSRF_COOKIE}=${csrfToken}; Path=/; SameSite=Strict; Max-Age=${SESSION_ABSOLUTE_MS / 1000}${secure}`,
  ];
}

export function expiredSessionCookies(): string[] {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [`${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`, `${CSRF_COOKIE}=; Path=/; SameSite=Strict; Max-Age=0${secure}`];
}

async function verifyTotp(userId: string, credential: { id: string; secretEncrypted: unknown; verifiedAt: Date | null; lastCounter: number | null }, token: string): Promise<boolean> {
  const env = runtimeEnv();
  if (!env.MFA_ENCRYPTION_KEY) return false;
  const cipher = new PiiCipher(JSON.stringify({ activeKeyId: "mfa-v1", keys: { "mfa-v1": env.MFA_ENCRYPTION_KEY } }));
  const secret = cipher.decrypt(credential.secretEncrypted, associatedData(userId, "totp")).plaintext;
  const totp = new OTPAuth.TOTP({ issuer: "МАНГАЛ", label: userId, algorithm: "SHA1", digits: 6, period: 30, secret });
  if (totp.validate({ token: token.replace(/\s/g, ""), window: 1 }) === null) return false;
  const counter = totp.counter();
  if (credential.lastCounter !== null && counter <= credential.lastCounter) return false;
  await db.$transaction([
    db.adminTotpCredential.update({ where: { id: credential.id }, data: { verifiedAt: credential.verifiedAt ?? new Date(), lastCounter: counter } }),
    db.adminUser.update({ where: { id: userId }, data: { mfaEnrolledAt: new Date() } }),
  ]);
  return true;
}

async function findRecoveryCode(codes: Array<{ id: string; codeHash: string }>, input: string) {
  for (const code of codes) if (await verify(code.codeHash, input)) return code;
  return null;
}

function sessionHash(token: string): string {
  const key = runtimeEnv().ADMIN_SESSION_HMAC_KEY;
  if (!key) throw new Error("ADMIN_SESSION_HMAC_KEY is unavailable");
  return createHmac("sha256", Buffer.from(key, "base64")).update(token).digest("hex");
}

function csrfHash(token: string): string {
  const key = runtimeEnv().CSRF_HMAC_KEY;
  if (!key) throw new Error("CSRF_HMAC_KEY is unavailable");
  return createHmac("sha256", Buffer.from(key, "base64")).update(token).digest("hex");
}

function cookieValue(request: Request, name: string): string | null {
  const match = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}
