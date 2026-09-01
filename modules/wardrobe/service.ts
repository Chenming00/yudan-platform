import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { authorize } from "@/lib/auth/authorization";
import { getDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors/app-error";
import type { ActionContext } from "@/lib/types/platform";
import { formatMoney } from "@/modules/ledger/money";
import type { CreateGiftedWardrobeItemsInput, CreateWardrobePurchaseInput, UpdateWardrobeItemStatusInput, WardrobeItemInput, WardrobeItemStatus } from "./types";

const itemInclude = {
  babyProfile: { select: { name: true } },
  wardrobePurchase: { select: { transactionAllocation: { select: { amount: true } } } },
} satisfies Prisma.WardrobeItemInclude;
type SelectedItem = Prisma.WardrobeItemGetPayload<{ include: typeof itemInclude }>;

function clean(value: string | null | undefined, label: string, maximum = 1_000) {
  const result = value?.trim();
  if (result && result.length > maximum) throw new AppError("VALIDATION_FAILED", `${label}不能超过 ${maximum} 个字符。`);
  return result || null;
}

function parseDate(value: string) {
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new AppError("VALIDATION_FAILED", "购买时间格式不正确。");
  return result;
}

function serializeItem(item: SelectedItem) {
  return {
    id: item.id,
    babyProfileId: item.babyProfileId,
    babyName: item.babyProfile?.name ?? null,
    name: item.name,
    category: item.category,
    size: item.size,
    season: item.season,
    color: item.color,
    quantity: item.quantity,
    status: item.status as WardrobeItemStatus,
    note: item.note,
    acquisition: item.wardrobePurchaseId ? "PURCHASED" as const : "GIFTED" as const,
    wardrobePurchaseId: item.wardrobePurchaseId,
    purchaseAmount: item.wardrobePurchase?.transactionAllocation ? formatMoney(item.wardrobePurchase.transactionAllocation.amount) : null,
    saleTransactionAllocationId: item.saleTransactionAllocationId,
    createdAt: item.createdAt.toISOString(),
  };
}

function itemData(householdId: string, item: WardrobeItemInput) {
  const name = item.name.trim();
  if (!name) throw new AppError("VALIDATION_FAILED", "衣物名称不能为空。");
  const quantity = item.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new AppError("VALIDATION_FAILED", "衣物数量必须是 1 到 100 的整数。");
  return {
    householdId,
    babyProfileId: item.babyProfileId || null,
    name: name.slice(0, 200),
    category: clean(item.category, "品类", 100),
    size: clean(item.size, "尺码", 100),
    season: clean(item.season, "季节", 100),
    color: clean(item.color, "颜色", 100),
    quantity,
    note: clean(item.note, "备注"),
  };
}

async function assertBabies(context: ActionContext, items: WardrobeItemInput[]) {
  const ids = [...new Set(items.flatMap((item) => item.babyProfileId ? [item.babyProfileId] : []))];
  if (!ids.length) return;
  const count = await getDatabase().babyProfile.count({ where: { id: { in: ids }, householdId: context.householdId } });
  if (count !== ids.length) throw new AppError("RESOURCE_NOT_FOUND", "选择的宝宝资料不存在。");
}

async function assertAllocation(context: ActionContext, id: string, type: "EXPENSE" | "INCOME") {
  const allocation = await getDatabase().transactionAllocation.findFirst({
    where: { id, householdId: context.householdId, module: "WARDROBE", transaction: { type, deletedAt: null } },
    select: { id: true },
  });
  if (!allocation) throw new AppError("RESOURCE_NOT_FOUND", type === "EXPENSE" ? "衣柜支出 Allocation 不存在。" : "衣柜收入 Allocation 不存在。");
}

export async function listItems(context: ActionContext) {
  await authorize({ context, permission: "wardrobe.read" });
  const rows = await getDatabase().wardrobeItem.findMany({
    where: { householdId: context.householdId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: itemInclude,
  });
  return rows.map(serializeItem);
}

export async function getItem(context: ActionContext, itemId: string) {
  await authorize({ context, permission: "wardrobe.read", resourceId: itemId });
  const row = await getDatabase().wardrobeItem.findFirst({
    where: { id: itemId, householdId: context.householdId },
    include: itemInclude,
  });
  if (!row) throw new AppError("RESOURCE_NOT_FOUND", "衣物不存在。");
  return serializeItem(row);
}

export async function listPurchases(context: ActionContext) {
  await authorize({ context, permission: "wardrobe.read" });
  const rows = await getDatabase().wardrobePurchase.findMany({
    where: { householdId: context.householdId, transactionAllocationId: { not: null } },
    orderBy: { purchasedAt: "desc" },
    include: { transactionAllocation: { select: { amount: true } }, _count: { select: { items: true } } },
  });
  return rows.flatMap((row) => row.transactionAllocationId && row.transactionAllocation ? [{
    id: row.id,
    purchasedAt: row.purchasedAt.toISOString(),
    merchant: row.merchant,
    note: row.note,
    transactionAllocationId: row.transactionAllocationId,
    amount: formatMoney(row.transactionAllocation.amount),
    itemCount: row._count.items,
  }] : []);
}

export async function createPurchase(context: ActionContext, input: CreateWardrobePurchaseInput) {
  await authorize({ context, permission: "wardrobe.write" });
  if (!input.items.length || input.items.length > 100) throw new AppError("VALIDATION_FAILED", "一次购买应包含 1 到 100 种衣物。");
  await Promise.all([assertBabies(context, input.items), assertAllocation(context, input.transactionAllocationId, "EXPENSE")]);
  try {
    const created = await getDatabase().$transaction(async (tx) => {
      const purchase = await tx.wardrobePurchase.create({
        data: {
          householdId: context.householdId,
          transactionAllocationId: input.transactionAllocationId,
          purchasedAt: parseDate(input.purchasedAt),
          merchant: clean(input.merchant, "商家", 300),
          note: clean(input.note, "备注"),
          items: { create: input.items.map((item) => itemData(context.householdId, item)) },
        },
        include: { transactionAllocation: { select: { amount: true } }, _count: { select: { items: true } } },
      });
      await writeAuditLog(tx, {
        action: "wardrobe.purchase.created",
        entityType: "WardrobePurchase",
        entityId: purchase.id,
        actorUserId: context.userId,
        householdId: context.householdId,
        requestId: context.requestId,
        afterData: { itemCount: purchase._count.items, allocationId: input.transactionAllocationId },
      });
      return purchase;
    });
    return {
      id: created.id,
      purchasedAt: created.purchasedAt.toISOString(),
      merchant: created.merchant,
      note: created.note,
      transactionAllocationId: created.transactionAllocationId!,
      amount: formatMoney(created.transactionAllocation!.amount),
      itemCount: created._count.items,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError("CONFLICT", "该账本 Allocation 已经关联过购买记录。");
    throw error;
  }
}

export async function createGiftedItems(context: ActionContext, input: CreateGiftedWardrobeItemsInput) {
  await authorize({ context, permission: "wardrobe.write" });
  if (!input.items.length || input.items.length > 100) throw new AppError("VALIDATION_FAILED", "一次赠送应包含 1 到 100 种衣物。");
  await assertBabies(context, input.items);
  const ids = await getDatabase().$transaction(async (tx) => {
    const rows = [];
    for (const item of input.items) rows.push(await tx.wardrobeItem.create({ data: itemData(context.householdId, item), select: { id: true } }));
    await writeAuditLog(tx, {
      action: "wardrobe.gift.created",
      entityType: "WardrobeItem",
      actorUserId: context.userId,
      householdId: context.householdId,
      requestId: context.requestId,
      afterData: { itemCount: rows.length },
    });
    return rows.map((row) => row.id);
  });
  const rows = await getDatabase().wardrobeItem.findMany({ where: { id: { in: ids }, householdId: context.householdId }, include: itemInclude });
  return rows.map(serializeItem);
}

const allowedTransitions: Record<WardrobeItemStatus, WardrobeItemStatus[]> = {
  ACTIVE: ["STORED", "DONATED", "SOLD", "DISCARDED"],
  STORED: ["ACTIVE", "DONATED", "SOLD", "DISCARDED"],
  DONATED: [], SOLD: [], DISCARDED: [],
};

export async function updateItemStatus(context: ActionContext, itemId: string, input: UpdateWardrobeItemStatusInput) {
  await authorize({ context, permission: "wardrobe.write", resourceId: itemId });
  const existing = await getDatabase().wardrobeItem.findFirst({ where: { id: itemId, householdId: context.householdId }, select: { id: true, status: true } });
  if (!existing) throw new AppError("RESOURCE_NOT_FOUND", "衣物不存在。");
  if (existing.status !== input.status && !allowedTransitions[existing.status].includes(input.status)) throw new AppError("CONFLICT", "当前衣物状态不能进行该变更。");
  if (input.status === "SOLD") {
    if (!input.saleTransactionAllocationId) throw new AppError("VALIDATION_FAILED", "出售衣物必须关联收入 Allocation。");
    await assertAllocation(context, input.saleTransactionAllocationId, "INCOME");
  } else if (input.saleTransactionAllocationId) throw new AppError("VALIDATION_FAILED", "只有出售状态可以关联收入 Allocation。");
  try {
    const row = await getDatabase().$transaction(async (tx) => {
      const updated = await tx.wardrobeItem.update({
        where: { id: itemId },
        data: { status: input.status, saleTransactionAllocationId: input.status === "SOLD" ? input.saleTransactionAllocationId : null },
        include: itemInclude,
      });
      await writeAuditLog(tx, {
        action: "wardrobe.item.status_changed",
        entityType: "WardrobeItem",
        entityId: itemId,
        actorUserId: context.userId,
        householdId: context.householdId,
        requestId: context.requestId,
        beforeData: { status: existing.status },
        afterData: { status: input.status, saleAllocationId: input.saleTransactionAllocationId ?? null },
      });
      return updated;
    });
    return serializeItem(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError("CONFLICT", "该收入 Allocation 已经关联其他衣物。");
    throw error;
  }
}

export const wardrobeService = { listItems, getItem, listPurchases, createPurchase, createGiftedItems, updateItemStatus };
