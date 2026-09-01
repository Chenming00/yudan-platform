import { describe, expect, it } from "vitest";

import { mapLegacyCategory } from "@/scripts/migration/category-map";

describe("legacy ledger category mapping", () => {
  it.each([
    ["医疗健康", "CHILD_CARE"],
    ["喂养用品", "CONSUMABLES"],
    ["护理清洁", "CONSUMABLES"],
    ["衣物穿戴", "WARDROBE"],
  ] as const)("maps %s to %s", (category, module) => {
    expect(mapLegacyCategory(category).module).toBe(module);
  });

  it.each(["大件用品", "购物消费", "其他", "未知分类"])(
    "does not guess a specific module for %s",
    (category) => {
      expect(mapLegacyCategory(category).module).toBe("OTHER");
    },
  );

  it("normalizes a missing category", () => {
    expect(mapLegacyCategory(null)).toMatchObject({
      category: "未分类",
      module: "OTHER",
    });
  });
});
