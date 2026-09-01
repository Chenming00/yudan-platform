import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const productionChecksums = {
  "20260617071218_init": "d6dde6e09d40201bb9a12c206700c2864a869c137b6b812c0ce0b2131ae37c84",
  "20260622132000_add_query_indexes": "f966c1f3ba728d6f4c10da4943c6d8148433756be1bedb6617e9d4d37957553f",
  "20260627193000_add_product_groups": "95e0f6f70f0f684e2d13953dd1d0bdd2ed9dfd2d8cc04f64bc466acaeafc5b6b",
  "20260627195500_add_custom_product_group_items": "795a76fa3de140ff1c85f5f73f709c97ccaec0c04cdde50d70a78f9b47715aa1",
  "20260627201000_normalize_product_group_item_unique_index": "e81d76feb65a543e4c55adb90b40f8cfc1dc3b59de39b3346d20c1c9f9238f0c",
  "20260824120000_harden_inventory_and_api": "d169730e5f8dd816a25334ede26bb65f59d8805ac9187ea79b3041b137030f39",
  "20260831130000_normalize_discarded_inventory": "47100eca25b48935c9def208e10132abe8a1d357a36964c6fe6d771ad5838b5c",
  "20260831131500_unique_custom_group_items": "ca51399201d59071330f03fa03e1800b28e491b6ea1ccf1b44757dd141fc3b78",
} as const;

describe("inherited yudan-wupin migration history", () => {
  it.each(Object.entries(productionChecksums))(
    "%s matches the checksum recorded in production",
    (migrationName, expectedChecksum) => {
      const sql = readFileSync(
        resolve(`prisma/migrations/${migrationName}/migration.sql`),
        "utf8",
      ).replace(/\r\n/g, "\n");
      const checksum = createHash("sha256").update(sql).digest("hex");
      expect(checksum).toBe(expectedChecksum);
    },
  );
});
