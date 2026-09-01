import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { giftedItemsSchema, wardrobePurchaseSchema, wardrobeStatusSchema } from "@/modules/wardrobe/schemas";

const uuid = "00000000-0000-0000-0000-000000000000";

describe("wardrobe input contracts", () => {
  it("allows gifts without a ledger allocation", () => {
    expect(giftedItemsSchema.safeParse({ items: [{ name: "外套", quantity: 2 }] }).success).toBe(true);
  });

  it("requires purchases to link one wardrobe expense allocation", () => {
    const purchase = { purchasedAt: "2026-09-01T10:00:00+08:00", transactionAllocationId: uuid, items: [{ name: "鞋子" }] };
    expect(wardrobePurchaseSchema.safeParse(purchase).success).toBe(true);
    expect(wardrobePurchaseSchema.safeParse({ ...purchase, transactionAllocationId: undefined }).success).toBe(false);
  });

  it("requires sold items to link an income allocation", () => {
    expect(wardrobeStatusSchema.safeParse({ status: "SOLD", saleTransactionAllocationId: uuid }).success).toBe(true);
    expect(wardrobeStatusSchema.safeParse({ status: "SOLD" }).success).toBe(false);
    expect(wardrobeStatusSchema.safeParse({ status: "DONATED", saleTransactionAllocationId: uuid }).success).toBe(false);
  });
});

describe("wardrobe persistence boundary", () => {
  it("enforces household scope and transaction direction", () => {
    const service = readFileSync(resolve("modules/wardrobe/service.ts"), "utf8");
    expect(service).toContain("householdId: context.householdId");
    expect(service).toContain('module: "WARDROBE"');
    expect(service).toContain('"EXPENSE"');
    expect(service).toContain('"INCOME"');
  });

  it("adds a unique sale allocation without removing purchase history", () => {
    const migration = readFileSync(resolve("prisma/migrations/20260901210000_wardrobe_sale_allocation/migration.sql"), "utf8");
    expect(migration).toContain("sale_transaction_allocation_id");
    expect(migration).toContain("CREATE UNIQUE INDEX");
    expect(migration).not.toContain("DROP TABLE");
  });
});
