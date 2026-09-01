import { describe, expect, it } from "vitest";

import { permissions, roles } from "@/lib/db/permission-catalog";

describe("permission catalog", () => {
  it("uses unique permission and role codes", () => {
    expect(new Set(permissions.map(([code]) => code)).size).toBe(
      permissions.length,
    );
    expect(new Set(roles.map((role) => role.code)).size).toBe(roles.length);
  });

  it("keeps platform administration global", () => {
    expect(
      roles.find((role) => role.code === "SUPER_ADMIN")?.permissions,
    ).toContain("platform.admin");
    expect(roles.find((role) => role.code === "OWNER")?.permissions).not.toContain(
      "platform.admin",
    );
  });

  it("makes viewer read-only", () => {
    const viewer = roles.find((role) => role.code === "VIEWER");
    expect(viewer?.permissions.length).toBeGreaterThan(0);
    expect(viewer?.permissions.every((permission) => permission.endsWith(".read"))).toBe(
      true,
    );
  });
});
