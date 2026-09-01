export type LegacyAllocationModule =
  | "CHILD_CARE"
  | "WARDROBE"
  | "CONSUMABLES"
  | "OTHER";

const categoryModuleMap = new Map<string, LegacyAllocationModule>([
  ["医疗健康", "CHILD_CARE"],
  ["喂养用品", "CONSUMABLES"],
  ["护理清洁", "CONSUMABLES"],
  ["衣物穿戴", "WARDROBE"],
]);

export function mapLegacyCategory(category: string | null) {
  const normalizedCategory = category?.trim() || "未分类";

  return {
    category: normalizedCategory,
    categoryCode: `legacy-${Buffer.from(normalizedCategory).toString("hex")}`,
    module: categoryModuleMap.get(normalizedCategory) ?? "OTHER",
  } as const;
}
