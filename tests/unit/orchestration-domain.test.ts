import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { compositeExpenseSchema, compositeRefundSchema } from "@/application/schemas";
import type { CreateCompositeExpenseInput } from "@/application/types";
import { validateAllocations } from "@/modules/ledger/validation";

const uuid = "00000000-0000-0000-0000-000000000000";
const expense = {
  idempotencyKey: "test-jd-520-0001",
  amount: "520.00",
  occurredAt: "2026-09-01T10:00:00+08:00",
  merchant: "京东",
  allocations: [
    { module: "CONSUMABLES", amount: "300.00", consumables: { items: [{ productCode: "001", quantity: 2, lineAmount: "300.00" }] } },
    { module: "WARDROBE", amount: "150.00", wardrobe: { items: [{ name: "儿童外套", quantity: 1 }] } },
    { module: "CHILD_CARE", amount: "70.00", care: { babyProfileId: uuid, type: "CHECKUP", occurredAt: "2026-09-01T10:00:00+08:00", title: "儿童保健" } },
  ],
} satisfies CreateCompositeExpenseInput;

describe("cross-module expense contract", () => {
  it("accepts the JD 520 example and totals it once", () => {
    expect(compositeExpenseSchema.safeParse(expense).success).toBe(true);
    const normalized = validateAllocations(expense.amount, expense.allocations);
    expect(normalized.total.toFixed(2)).toBe("520.00");
  });

  it("requires business details to match the allocation module", () => {
    expect(compositeExpenseSchema.safeParse({ ...expense, allocations: [{ module: "WARDROBE", amount: "520.00", care: expense.allocations[2].care }] }).success).toBe(false);
  });

  it("rejects allocation totals different from the payment", () => {
    expect(() => validateAllocations("519.00", expense.allocations)).toThrow("拆分金额合计必须等于");
  });

  it("uses one serializable transaction for ledger and business records", () => {
    const source = readFileSync(resolve("application/expense-orchestrator.ts"), "utf8");
    expect(source).toContain("$transaction(async (tx)");
    expect(source).toContain("TransactionIsolationLevel.Serializable");
    expect(source).toContain("tx.transaction.create");
    expect(source).toContain("tx.transactionAllocation.create");
    expect(source).toContain("tx.careRecord.create");
    expect(source).toContain("tx.wardrobePurchase.create");
    expect(source).toContain("tx.consumablePurchase.create");
    expect(source).toContain("tx.stockEntry.create");
    expect(source).toContain("tx.idempotencyKey.update");
  });
});

describe("refund orchestration", () => {
  it("requires an idempotency key and allocation breakdown", () => {
    const input = { idempotencyKey: "refund-test-0001", originalTransactionId: uuid, amount: "70.00", occurredAt: "2026-09-02T10:00:00+08:00", allocations: [{ module: "CHILD_CARE", amount: "70.00" }] };
    expect(compositeRefundSchema.safeParse(input).success).toBe(true);
    expect(compositeRefundSchema.safeParse({ ...input, idempotencyKey: undefined }).success).toBe(false);
  });

  it("locks the original expense before calculating refundable balances", () => {
    const source = readFileSync(resolve("application/refund-orchestrator.ts"), "utf8");
    expect(source).toContain("FOR UPDATE");
    expect(source).toContain("refundOfTransactionId");
    expect(source).toContain("createIdempotencyRow");
    expect(source).toContain("tx.idempotencyKey.update");
  });
});
