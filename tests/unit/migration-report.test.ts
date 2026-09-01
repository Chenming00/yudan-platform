import { describe, expect, it } from "vitest";

import { buildLedgerReport, buildMigrationChecks, type PantryReport } from "@/scripts/migration/report";

const pantry: PantryReport = {
  productCount: 34,
  stockEntryCount: 49,
  inventoryLogCount: 89,
  productGroupCount: 2,
  productGroupItemCount: 24,
  availableQuantity: 100,
  platformSchemaReady: true,
  stockByProduct: [{ productCode: "milk", availableQuantity: 100 }],
};

describe("migration report", () => {
  it("totals money exactly and groups by month and module", () => {
    const report = buildLedgerReport([
      { amount: "0.10", category: "医疗健康", type: "expense", occurredAt: new Date("2026-01-01T00:00:00Z") },
      { amount: "0.20", category: "衣物穿戴", type: "expense", occurredAt: new Date("2026-01-02T00:00:00Z") },
      { amount: "10", category: null, type: "income", occurredAt: new Date("2026-02-01T00:00:00Z") },
    ]);

    expect(report).toMatchObject({ count: 3, income: "10.00", expense: "0.30" });
    expect(report.byMonth).toEqual([
      { month: "2026-01", count: 2, income: "0.00", expense: "0.30" },
      { month: "2026-02", count: 1, income: "10.00", expense: "0.00" },
    ]);
    expect(report.byModule).toEqual({ CHILD_CARE: 1, WARDROBE: 1, OTHER: 1 });
  });

  it("blocks apply until the platform schema and source invariants are ready", () => {
    expect(buildMigrationChecks({ ledgerCount: 113, babyProfiles: 2, distinctBirthdays: 1, pantry }).safeToApply).toBe(true);
    expect(buildMigrationChecks({
      ledgerCount: 113,
      babyProfiles: 2,
      distinctBirthdays: 1,
      pantry: { ...pantry, platformSchemaReady: false },
    }).safeToApply).toBe(false);
  });

  it("blocks negative stock instead of silently normalizing it", () => {
    const result = buildMigrationChecks({
      ledgerCount: 113,
      babyProfiles: 2,
      distinctBirthdays: 1,
      pantry: { ...pantry, stockByProduct: [{ productCode: "milk", availableQuantity: -1 }] },
    });
    expect(result.checks).toContainEqual({ name: "pantry-stock-nonnegative", status: "BLOCKED" });
  });

  it("uses the household timezone for month boundaries", () => {
    const report = buildLedgerReport([
      { amount: "1", category: "其他", type: "expense", occurredAt: new Date("2026-01-31T16:30:00Z") },
    ]);
    expect(report.byMonth[0].month).toBe("2026-02");
  });
});
