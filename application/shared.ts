import "server-only";

import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { authorize } from "@/lib/auth/authorization";
import { getDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors/app-error";
import type { ActionContext } from "@/lib/types/platform";
import { assertCategoryCompatibility, normalizeNullableText } from "@/modules/ledger/validation";
import type { PermissionCode } from "@/modules/auth/types";
import type { CompositeExpenseAllocationInput } from "./types";

export function requestHash(input: unknown) {
  const canonical = (value: unknown): unknown => Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]))
      : value;
  return createHash("sha256").update(JSON.stringify(canonical(input))).digest("hex");
}

export async function authorizeCompositeExpense(context: ActionContext, allocations: CompositeExpenseAllocationInput[]) {
  const permissions = new Set<PermissionCode>(["ledger.write"]);
  for (const allocation of allocations) {
    if (allocation.module === "CHILD_CARE") permissions.add("care.write");
    if (allocation.module === "WARDROBE") permissions.add("wardrobe.write");
    if (allocation.module === "CONSUMABLES") permissions.add("consumables.write");
  }
  await Promise.all([...permissions].map((permission) => authorize({ context, permission })));
}

export async function validateCompositeReferences(context: ActionContext, paymentAccountId: string | undefined, allocations: CompositeExpenseAllocationInput[]) {
  const db = getDatabase();
  const categoryIds = [...new Set(allocations.flatMap((item) => item.categoryId ? [item.categoryId] : []))];
  const babyIds = [...new Set(allocations.flatMap((item) => [item.care?.babyProfileId, ...(item.wardrobe?.items.flatMap((wardrobe) => wardrobe.babyProfileId ? [wardrobe.babyProfileId] : []) ?? [])]).filter((value): value is string => Boolean(value)))];
  const productCodes = [...new Set(allocations.flatMap((item) => item.consumables?.items.map((product) => product.productCode) ?? []))];
  const [categories, account, babies, products] = await Promise.all([
    categoryIds.length ? db.category.findMany({ where: { id: { in: categoryIds }, householdId: context.householdId, isActive: true }, select: { id: true, module: true } }) : [],
    paymentAccountId ? db.paymentAccount.findFirst({ where: { id: paymentAccountId, householdId: context.householdId, isActive: true }, select: { id: true } }) : null,
    babyIds.length ? db.babyProfile.findMany({ where: { id: { in: babyIds }, householdId: context.householdId }, select: { id: true } }) : [],
    productCodes.length ? db.product.findMany({ where: { productCode: { in: productCodes }, householdId: context.householdId, isActive: 1 }, select: { productCode: true, name: true } }) : [],
  ]);
  assertCategoryCompatibility(allocations, categories);
  if (paymentAccountId && !account) throw new AppError("VALIDATION_FAILED", "支付账户不存在或不可用。");
  if (babies.length !== babyIds.length) throw new AppError("RESOURCE_NOT_FOUND", "选择的宝宝资料不存在。");
  if (products.length !== productCodes.length) throw new AppError("RESOURCE_NOT_FOUND", "消耗品明细中存在无效产品。");
  return new Map(products.map((product) => [product.productCode, product.name]));
}

export function clean(value: string | null | undefined, maximum = 1_000) {
  return normalizeNullableText(value)?.slice(0, maximum) ?? null;
}

export function stockCode(productCode: string) {
  return `STK-${productCode}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function readIdempotentResponse<T extends object>(context: ActionContext, scope: string, key: string, hash: string) {
  const row = await getDatabase().idempotencyKey.findUnique({ where: { householdId_scope_key: { householdId: context.householdId, scope, key } }, select: { requestHash: true, responseBody: true } });
  if (!row) return null;
  if (row.requestHash !== hash) throw new AppError("IDEMPOTENCY_CONFLICT", "同一个幂等键不能用于不同请求。");
  if (!row.responseBody || typeof row.responseBody !== "object" || Array.isArray(row.responseBody)) throw new AppError("CONFLICT", "该请求仍在处理中，请稍后重试。");
  return { ...(row.responseBody as T), replayed: true };
}

export async function createIdempotencyRow(tx: Prisma.TransactionClient, context: ActionContext, scope: string, key: string, hash: string) {
  await tx.idempotencyKey.create({ data: { householdId: context.householdId, scope, key, requestHash: hash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000) } });
}

export function isRetryableTransaction(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}
