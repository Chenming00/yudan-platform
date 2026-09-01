import { describe, expect, it } from "vitest";

import {
  getCachedPermissions,
  invalidatePermissionCache,
  setCachedPermissions,
} from "@/lib/auth/permission-cache";
import { MemoryRateLimiter } from "@/lib/auth/rate-limit";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { hashOpaqueToken, normalizeEmail } from "@/lib/auth/tokens";
import { registerSchema } from "@/lib/auth/validation";

describe("auth security helpers", () => {
  it("normalizes trusted emails consistently", () => {
    expect(normalizeEmail("  William.Chen@Utah.edu ")).toBe("william.chen@utah.edu");
  });

  it("uses deterministic SHA-256 hashes without preserving raw tokens", () => {
    const hash = hashOpaqueToken("private-invitation-code");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("private-invitation-code");
    expect(hashOpaqueToken("private-invitation-code")).toBe(hash);
  });

  it("rejects external and protocol-relative redirect targets", () => {
    expect(getSafeRedirectPath("https://attacker.example", "/safe")).toBe("/safe");
    expect(getSafeRedirectPath("//attacker.example", "/safe")).toBe("/safe");
    expect(getSafeRedirectPath("/ledger?month=2026-09", "/safe")).toBe(
      "/ledger?month=2026-09",
    );
  });

  it("requires matching passwords and an invitation", () => {
    const result = registerSchema.safeParse({
      displayName: "成员",
      email: "member@example.com",
      password: "password-one",
      confirmPassword: "password-two",
      invitationCode: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.confirmPassword).toBeDefined();
      expect(fields.invitationCode).toBeDefined();
    }
  });

  it("actively invalidates cached permissions for a user", () => {
    setCachedPermissions("user-1", "household-1", ["ledger.read"]);
    expect(getCachedPermissions("user-1", "household-1")?.has("ledger.read")).toBe(true);
    invalidatePermissionCache("user-1");
    expect(getCachedPermissions("user-1", "household-1")).toBeNull();
  });

  it("rate limits repeated auth operations without storing the subject", async () => {
    const limiter = new MemoryRateLimiter();
    const request = {
      action: "login" as const,
      subject: `member-${crypto.randomUUID()}@example.com`,
      limit: 1,
      windowMs: 60_000,
    };
    await limiter.consume(request);
    await expect(limiter.consume(request)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});
