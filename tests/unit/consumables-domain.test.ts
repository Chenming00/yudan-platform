import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { planDeductions, planInventoryCount } from "@/modules/consumables/planning";
import { consumablePurchaseSchema, receiveStockSchema } from "@/modules/consumables/schemas";

const entries = [
  { id: 1, availableQuantity: 4, expiryDate: null, createdAt: "2026-01-01T00:00:00Z" },
  { id: 2, availableQuantity: 2, expiryDate: "2026-10-01", createdAt: "2026-02-01T00:00:00Z" },
  { id: 3, availableQuantity: 3, expiryDate: "2026-09-15", createdAt: "2026-03-01T00:00:00Z" },
];

describe("consumables stock planning", () => {
  it("uses the earliest expiry before undated stock", () => {
    expect(planDeductions(entries, 6)).toEqual([
      { id: 3, beforeQuantity: 3, afterQuantity: 0, quantity: 3 },
      { id: 2, beforeQuantity: 2, afterQuantity: 0, quantity: 2 },
      { id: 1, beforeQuantity: 4, afterQuantity: 3, quantity: 1 },
    ]);
  });

  it("refuses to create negative stock", () => {
    expect(() => planDeductions(entries, 10)).toThrow("库存不足");
  });

  it("counts down with FEFO and counts up on the newest entry", () => {
    expect(planInventoryCount(entries, 7).changes.map((item) => item.id)).toEqual([3]);
    expect(planInventoryCount(entries, 12).changes).toEqual([{ id: 3, beforeQuantity: 3, afterQuantity: 6, quantity: 3 }]);
  });
});

describe("consumables contracts", () => {
  it("allows non-purchase stock without a ledger allocation", () => {
    expect(receiveStockSchema.safeParse({ productCode: "001", quantity: 2, source: "GIFT" }).success).toBe(true);
  });

  it("requires purchases to link a consumables allocation", () => {
    const input = { transactionAllocationId: "00000000-0000-0000-0000-000000000000", purchasedAt: "2026-09-01T10:00:00+08:00", items: [{ productCode: "001", quantity: 2, lineAmount: "20.00" }] };
    expect(consumablePurchaseSchema.safeParse(input).success).toBe(true);
    expect(consumablePurchaseSchema.safeParse({ ...input, transactionAllocationId: undefined }).success).toBe(false);
  });

  it("keeps inventory mutations scoped, locked, and serializable", () => {
    const service = readFileSync(resolve("modules/consumables/service.ts"), "utf8");
    expect(service).toContain("householdId: context.householdId");
    expect(service).toContain("FOR UPDATE");
    expect(service).toContain("TransactionIsolationLevel.Serializable");
    expect(service).toContain('module: "CONSUMABLES"');
    expect(service).toContain("total.equals(allocation.amount)");
  });

  it("does not ask users for an internal stock-entry identifier", () => {
    const form = readFileSync(resolve("components/consumables/inventory-operation-form.tsx"), "utf8");
    expect(form).not.toContain('name="batch');
    expect(form).not.toContain('name="stockEntry');
  });
});
