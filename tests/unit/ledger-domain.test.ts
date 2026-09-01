import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { decodeLedgerCursor, encodeLedgerCursor } from "@/modules/ledger/cursor";
import { formatMoney, parseMoney, sumMoney } from "@/modules/ledger/money";
import { assertCategoryCompatibility, validateAllocations } from "@/modules/ledger/validation";

describe("ledger money and allocation invariants", () => {
  it("adds decimal strings exactly without floating point drift", () => {
    const total = sumMoney([parseMoney("0.10"), parseMoney("0.20"), parseMoney("19.70")]);
    expect(formatMoney(total)).toBe("20.00");
  });

  it.each(["0", "-1", "1.001", "01.00", "1000000000000.00"])("rejects invalid amount %s", (amount) => {
    expect(() => parseMoney(amount)).toThrowError(/金额|大于 0/);
  });

  it("requires allocation sums to equal the transaction total", () => {
    expect(() => validateAllocations("10.00", [
      { module: "CHILD_CARE", amount: "4.00" },
      { module: "CONSUMABLES", amount: "5.99" },
    ])).toThrowError("拆分金额合计必须等于账目总金额。");
  });

  it("accepts an exact multi-module split", () => {
    const result = validateAllocations("10.00", [
      { module: "CHILD_CARE", amount: "4.00" },
      { module: "CONSUMABLES", amount: "6.00" },
    ]);
    expect(formatMoney(result.total)).toBe("10.00");
    expect(result.allocations).toHaveLength(2);
  });

  it("rejects a category from another module", () => {
    expect(() => assertCategoryCompatibility(
      [{ module: "WARDROBE", categoryId: "care-category" }],
      [{ id: "care-category", module: "CHILD_CARE" }],
    )).toThrowError("分类不存在或与用途模块不匹配。");
  });
});
describe("ledger cursor", () => {
  it("round-trips the stable date and id ordering cursor", () => {
    const value = { transactionAt: "2026-09-01T12:00:00.000Z", id: "00000000-0000-4000-8000-000000000001" };
    expect(decodeLedgerCursor(encodeLedgerCursor(value))).toEqual(value);
  });

  it("rejects malformed cursors", () => {
    expect(() => decodeLedgerCursor("not-a-cursor")).toThrowError("分页游标无效。");
  });
});

describe("ledger refund persistence", () => {
  const schema = readFileSync(resolve("prisma/schema.prisma"), "utf8");
  const migration = readFileSync(resolve("prisma/migrations/20260901170000_ledger_refund_relation/migration.sql"), "utf8");

  it("keeps a restrictive self relation to the original expense", () => {
    expect(schema).toContain("refundOfTransactionId");
    expect(schema).toContain('@relation("transaction_refunds"');
    expect(migration).toContain('"refund_of_transaction_id"');
    expect(migration).toContain("ON DELETE RESTRICT");
    expect(migration).toContain("transactions_refund_shape_check");
  });
});
