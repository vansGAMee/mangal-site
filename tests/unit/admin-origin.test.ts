import { describe, expect, it, vi } from "vitest";
import { validateAdminMutation, AdminAuthError } from "../../apps/platform/src/server/admin/auth";

process.env.ADMIN_SESSION_HMAC_KEY = Buffer.from("test-key-32-bytes-long-for-hmac-hash!").toString("base64");

vi.mock("../../apps/platform/src/server/shared/db", () => ({
  db: {
    adminSession: {
      findUnique: vi.fn().mockResolvedValue({
        id: "sess-1",
        revokedAt: null,
        idleExpiresAt: new Date(Date.now() + 100000),
        absoluteExpiresAt: new Date(Date.now() + 100000),
        adminUser: { id: "admin-1", isActive: true, role: "ADMIN", emailNormalized: "admin@example.com", permissions: [] },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("validateAdminMutation origin validation", () => {
  it("allows request when origin host matches x-forwarded-host behind proxy", async () => {
    const request = new Request("http://127.0.0.1:3000/api/admin/settings", {
      method: "PATCH",
      headers: {
        origin: "https://mangal-vrn.ru",
        "x-forwarded-host": "mangal-vrn.ru",
        cookie: "mangal_admin_dev=token123",
      },
    });
    const admin = await validateAdminMutation(request);
    expect(admin.id).toBe("admin-1");
  });

  it("allows request when origin host matches host header", async () => {
    const request = new Request("http://127.0.0.1:3000/api/admin/settings", {
      method: "PATCH",
      headers: {
        origin: "http://localhost:3000",
        host: "localhost:3000",
        cookie: "mangal_admin_dev=token123",
      },
    });
    const admin = await validateAdminMutation(request);
    expect(admin.id).toBe("admin-1");
  });

  it("rejects request when origin host does not match request host", async () => {
    const request = new Request("http://127.0.0.1:3000/api/admin/settings", {
      method: "PATCH",
      headers: {
        origin: "https://malicious-site.com",
        host: "mangal-vrn.ru",
        cookie: "mangal_admin_dev=token123",
      },
    });
    await expect(validateAdminMutation(request)).rejects.toThrow(AdminAuthError);
  });
});

