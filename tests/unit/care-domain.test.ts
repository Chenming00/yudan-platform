import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { careRecordSchema, growthSchema } from "@/modules/care/schemas";

describe("care domain contracts", () => {
  it("accepts supported care types and rejects legacy names", () => {
    const base = { babyProfileId: "00000000-0000-0000-0000-000000000000", occurredAt: "2026-09-01T09:00:00+08:00", title: "常规儿保" };
    expect(careRecordSchema.safeParse({ ...base, type: "CHECKUP" }).success).toBe(true);
    expect(careRecordSchema.safeParse({ ...base, type: "VACCINE" }).success).toBe(false);
  });
  it("validates bounded growth measurements", () => {
    const base = { babyProfileId: "00000000-0000-0000-0000-000000000000", measuredOn: "2026-09-01", weightKg: "12.345" };
    expect(growthSchema.safeParse(base).success).toBe(true);
    expect(growthSchema.safeParse({ ...base, weightKg: "12.3456" }).success).toBe(false);
    expect(growthSchema.safeParse({ ...base, weightKg: "-1" }).success).toBe(false);
  });
});

describe("care persistence boundary", () => {
  it("keeps care queries household-scoped and supports allocation links", () => {
    const source = readFileSync(resolve("modules/care/service.ts"), "utf8");
    expect(source).toContain("householdId: context.householdId");
    expect(source).toContain("transactionAllocationId");
    expect(source).toContain('module: "CHILD_CARE"');
  });
});
