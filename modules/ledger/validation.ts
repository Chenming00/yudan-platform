import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { parseMoney, sumMoney } from "@/modules/ledger/money";
import type { TransactionAllocationInput } from "@/modules/ledger/types";

export function parseOccurredAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("VALIDATION_FAILED", "交易时间无效。" );
  }
  return date;
}

export function validateAllocations(
  totalValue: string,
  allocations: TransactionAllocationInput[],
) {
  if (!allocations.length || allocations.length > 20) {
    throw new AppError("VALIDATION_FAILED", "账目需要 1 至 20 条用途拆分。" );
  }
  const total = parseMoney(totalValue, "总金额");
  const normalized = allocations.map((allocation, index) => ({
    module: allocation.module,
    categoryId: allocation.categoryId || undefined,
    amount: parseMoney(allocation.amount, `第 ${index + 1} 条拆分金额`),
    note: allocation.note?.trim() || undefined,
  }));
  if (!sumMoney(normalized.map((item) => item.amount)).equals(total)) {
    throw new AppError("VALIDATION_FAILED", "拆分金额合计必须等于账目总金额。" );
  }
  return { total, allocations: normalized };
}

export function assertCategoryCompatibility(
  allocations: Array<{ module: string; categoryId?: string }>,
  categories: Array<{ id: string; module: string }>,
) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  for (const allocation of allocations) {
    if (!allocation.categoryId) continue;
    const category = byId.get(allocation.categoryId);
    if (!category || category.module !== allocation.module) {
      throw new AppError("VALIDATION_FAILED", "分类不存在或与用途模块不匹配。" );
    }
  }
}

export function normalizeNullableText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 1_000) : null;
}

export type NormalizedAllocation = {
  module: TransactionAllocationInput["module"];
  categoryId?: string;
  amount: Prisma.Decimal;
  note?: string;
};
