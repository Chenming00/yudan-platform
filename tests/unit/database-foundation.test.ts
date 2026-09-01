import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve("prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  resolve(
    "prisma/migrations/20260901120000_platform_foundation/migration.sql",
  ),
  "utf8",
);

describe("database foundation", () => {
  it.each([
    "AppUser",
    "Household",
    "Invitation",
    "RegistrationIntent",
    "Transaction",
    "TransactionAllocation",
    "BabyProfile",
    "GrowthRecord",
    "WardrobeItem",
    "Product",
    "StockEntry",
    "InventoryLog",
    "MediaAsset",
    "LegacyImportMap",
  ])("defines the %s model", (model) => {
    expect(schema).toContain(`model ${model} {`);
  });

  it("does not duplicate authentication secrets", () => {
    expect(schema).not.toMatch(/password|oauth.*secret/i);
  });

  it("upgrades retained inventory without dropping legacy tables", () => {
    expect(migration).not.toMatch(
      /DROP TABLE\s+"?(products|inventory_batches|inventory_logs|product_groups)/i,
    );
    expect(migration).toContain('UPDATE "products" SET "household_id"');
    expect(migration).toContain('ALTER COLUMN "purchase_price" SET DATA TYPE DECIMAL');
  });

  it("enforces household RLS and invite-only signup", () => {
    expect(migration).toContain("private.is_household_member");
    expect(migration).toContain("private.before_user_created");
    expect(migration).toContain("private.handle_new_auth_user");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
  });
});
