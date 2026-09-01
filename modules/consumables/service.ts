import "server-only";

import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { authorize } from "@/lib/auth/authorization";
import { getDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors/app-error";
import type { ActionContext } from "@/lib/types/platform";
import { formatMoney } from "@/modules/ledger/money";
import { businessToday, daysUntilExpiry, parseBusinessDate } from "./date";
import { planDeductions, planInventoryCount } from "./planning";
import type { CreateConsumablePurchaseInput, CreateProductInput, ReceiveStockInput } from "./types";

type LockedEntry = { id: number; legacyBatchCode: string; availableQuantity: number; expiryDate: Date | null; createdAt: Date; updatedAt: Date };
type BatchChange = { batch_code: string; quantity: number; before_quantity: number; after_quantity: number; batch_updated_at: string };

function clean(value: string | null | undefined, label: string, maximum = 1_000) {
  const result = value?.trim();
  if (result && result.length > maximum) throw new AppError("VALIDATION_FAILED", `${label}不能超过 ${maximum} 个字符。`);
  return result || null;
}

function quantity(value: number, label = "数量") {
  if (!Number.isInteger(value) || value < 1 || value > 99_999) throw new AppError("VALIDATION_FAILED", `${label}必须是 1 到 99999 的整数。`);
  return value;
}

function decimal(value: string | undefined, label: string) {
  if (!value || !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,4})?$/.test(value)) throw new AppError("VALIDATION_FAILED", `${label}格式不正确。`);
  return new Prisma.Decimal(value);
}

function expiry(value?: string) {
  if (!value) return null;
  const parsed = parseBusinessDate(value);
  if (!parsed) throw new AppError("VALIDATION_FAILED", "到期日期格式不正确。");
  return parsed;
}

function stockCode(productCode: string) {
  return `STK-${productCode}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

async function assertProduct(context: ActionContext, productCode: string) {
  const product = await getDatabase().product.findFirst({ where: { productCode, householdId: context.householdId, isActive: 1 }, select: { productCode: true } });
  if (!product) throw new AppError("RESOURCE_NOT_FOUND", "产品不存在或已停用。");
}

async function currentStock(productCode: string, householdId: string, client = getDatabase()) {
  const rows = await client.stockEntry.aggregate({
    where: { productCode, householdId, status: "ACTIVE", availableQuantity: { gt: 0 }, OR: [{ expiryDate: null }, { expiryDate: { gte: businessToday() } }] },
    _sum: { availableQuantity: true },
  });
  return rows._sum.availableQuantity ?? 0;
}

async function loadProducts(context: ActionContext) {
  const rows = await getDatabase().product.findMany({
    where: { householdId: context.householdId, isActive: 1 },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { stockEntries: { where: { status: "ACTIVE", availableQuantity: { gt: 0 } }, select: { availableQuantity: true, expiryDate: true } } },
  });
  const today = businessToday();
  return rows.map((row) => {
    let current = 0;
    let expired = 0;
    let nearest: number | null = null;
    for (const entry of row.stockEntries) {
      if (entry.expiryDate && entry.expiryDate < today) { expired += entry.availableQuantity; continue; }
      current += entry.availableQuantity;
      if (entry.expiryDate) {
        const days = daysUntilExpiry(entry.expiryDate);
        nearest = nearest === null ? days : Math.min(nearest, days);
      }
    }
    return {
      productCode: row.productCode, name: row.name, category: row.category, unit: row.unit, spec: row.spec, barcode: row.barcode,
      minStock: row.minStock, isFavorite: row.isFavorite === 1, skipReplenishment: row.isGroupable === 1, isActive: row.isActive === 1,
      note: row.note, currentStock: current, stockStatus: current === 0 ? "OUT" as const : current <= row.minStock ? "LOW" as const : "OK" as const,
      nearestExpiryDays: nearest, expiredQuantity: expired,
    };
  });
}

export async function listProducts(context: ActionContext) {
  await authorize({ context, permission: "consumables.read" });
  return loadProducts(context);
}

export async function getSummary(context: ActionContext) {
  await authorize({ context, permission: "consumables.read" });
  const products = await loadProducts(context);
  const replenishList = products.filter((item) => !item.skipReplenishment && item.currentStock <= item.minStock).map((item) => ({
    productCode: item.productCode, name: item.name, unit: item.unit, currentStock: item.currentStock, minStock: item.minStock,
    suggestedQuantity: Math.max(item.minStock * 2 - item.currentStock, 1),
  }));
  return {
    productCount: products.length,
    currentUnits: products.reduce((sum, item) => sum + item.currentStock, 0),
    lowStockCount: products.filter((item) => !item.skipReplenishment && item.stockStatus === "LOW").length,
    outOfStockCount: products.filter((item) => !item.skipReplenishment && item.stockStatus === "OUT").length,
    nearExpiryCount: products.filter((item) => item.nearestExpiryDays !== null && item.nearestExpiryDays <= 30).length,
    expiredCount: products.filter((item) => item.expiredQuantity > 0).length,
    replenishList,
  };
}

async function nextProductCode() {
  const rows = await getDatabase().product.findMany({ select: { productCode: true } });
  let max = 0; let width = 3;
  for (const row of rows) if (/^\d+$/.test(row.productCode)) { max = Math.max(max, Number(row.productCode)); width = Math.max(width, row.productCode.length); }
  return String(max + 1).padStart(width, "0");
}

export async function createProduct(context: ActionContext, input: CreateProductInput) {
  await authorize({ context, permission: "consumables.write" });
  const name = clean(input.name, "产品名称", 200); const category = clean(input.category, "分类", 100); const unit = clean(input.unit, "单位", 50);
  if (!name || !category || !unit) throw new AppError("VALIDATION_FAILED", "产品名称、分类和单位必填。");
  const minStock = input.minStock ?? 2;
  if (!Number.isInteger(minStock) || minStock < 0 || minStock > 99_999) throw new AppError("VALIDATION_FAILED", "安全库存必须是 0 到 99999 的整数。");
  const barcode = clean(input.barcode, "条码", 100);
  if (barcode && await getDatabase().product.findFirst({ where: { barcode }, select: { productCode: true } })) throw new AppError("CONFLICT", "该条码已被其他产品使用。");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const productCode = await nextProductCode();
      await getDatabase().$transaction(async (tx) => {
        await tx.product.create({ data: { productCode, householdId: context.householdId, name, category, unit, spec: clean(input.spec, "规格", 200), barcode, minStock, isFavorite: input.isFavorite ? 1 : 0, isGroupable: input.skipReplenishment ? 1 : 0, note: clean(input.note, "备注") } });
        await writeAuditLog(tx, { action: "consumables.product.created", entityType: "Product", entityId: productCode, actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId });
      });
      return (await loadProducts(context)).find((item) => item.productCode === productCode)!;
    } catch (error) {
      if (attempt < 4 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new AppError("CONFLICT", "产品编码生成失败，请重试。");
}

export async function receiveStock(context: ActionContext, input: ReceiveStockInput) {
  await authorize({ context, permission: "consumables.write" });
  await assertProduct(context, input.productCode);
  const received = quantity(input.quantity, "入库数量"); const expiration = expiry(input.expiresOn);
  const totalCost = input.totalCost ? decimal(input.totalCost, "成本") : null;
  const result = await getDatabase().$transaction(async (tx) => {
    const entry = await tx.stockEntry.create({ data: { householdId: context.householdId, legacyBatchCode: stockCode(input.productCode), productCode: input.productCode, initialQuantity: received, availableQuantity: received, expiryDate: expiration, storageLocation: clean(input.storageLocation, "存放位置", 200), purchaseSource: input.sourceLabel || input.source, purchasePrice: totalCost, unitPrice: totalCost ? totalCost.div(received) : null, note: clean(input.note, "备注") } });
    const changedAt = entry.updatedAt.toISOString();
    const log = await tx.inventoryLog.create({ data: { householdId: context.householdId, productCode: input.productCode, legacyBatchCode: entry.legacyBatchCode, actionType: "IN", quantity: received, beforeQuantity: 0, afterQuantity: received, reason: input.source, note: clean(input.note, "备注"), details: { version: 2, source: input.source, batches: [{ batch_code: entry.legacyBatchCode, quantity: received, before_quantity: 0, after_quantity: received, batch_updated_at: changedAt }] } } });
    await writeAuditLog(tx, { action: "consumables.stock.received", entityType: "InventoryLog", entityId: String(log.id), actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId, afterData: { productCode: input.productCode, quantity: received, source: input.source } });
    return { logId: log.id, stockEntryCode: entry.legacyBatchCode };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { ...result, productCode: input.productCode, quantity: received, currentStock: await currentStock(input.productCode, context.householdId) };
}

export async function createPurchase(context: ActionContext, input: CreateConsumablePurchaseInput) {
  await authorize({ context, permission: "consumables.write" });
  if (!input.items.length || input.items.length > 100) throw new AppError("VALIDATION_FAILED", "一次采购应包含 1 到 100 种产品。");
  const productCodes = [...new Set(input.items.map((item) => item.productCode))];
  const [products, allocation] = await Promise.all([
    getDatabase().product.findMany({ where: { productCode: { in: productCodes }, householdId: context.householdId, isActive: 1 }, select: { productCode: true } }),
    getDatabase().transactionAllocation.findFirst({ where: { id: input.transactionAllocationId, householdId: context.householdId, module: "CONSUMABLES", transaction: { type: "EXPENSE", deletedAt: null } }, select: { id: true, amount: true } }),
  ]);
  if (products.length !== productCodes.length) throw new AppError("RESOURCE_NOT_FOUND", "采购清单中存在无效产品。");
  if (!allocation) throw new AppError("RESOURCE_NOT_FOUND", "消耗品支出 Allocation 不存在。");
  const lines = input.items.map((item) => ({ ...item, quantity: quantity(item.quantity, "采购数量"), amount: decimal(item.lineAmount, "行金额"), expiration: expiry(item.expiresOn), unit: item.unitPrice ? decimal(item.unitPrice, "单价") : null }));
  const total = lines.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
  if (!total.equals(allocation.amount)) throw new AppError("VALIDATION_FAILED", "采购明细金额合计必须等于账本 Allocation 金额。");
  const purchasedAt = new Date(input.purchasedAt);
  if (Number.isNaN(purchasedAt.getTime())) throw new AppError("VALIDATION_FAILED", "采购时间格式不正确。");
  try {
    const purchase = await getDatabase().$transaction(async (tx) => {
      const created = await tx.consumablePurchase.create({ data: { householdId: context.householdId, transactionAllocationId: input.transactionAllocationId, purchasedAt, merchant: clean(input.merchant, "商家", 300), note: clean(input.note, "备注") } });
      for (const line of lines) {
        const purchaseItem = await tx.consumablePurchaseItem.create({ data: { householdId: context.householdId, consumablePurchaseId: created.id, productCode: line.productCode, description: clean(line.description, "描述", 300) || line.productCode, quantity: line.quantity, unitPrice: line.unit ?? line.amount.div(line.quantity), lineAmount: line.amount } });
        const entry = await tx.stockEntry.create({ data: { householdId: context.householdId, legacyBatchCode: stockCode(line.productCode), productCode: line.productCode, purchaseItemId: purchaseItem.id, initialQuantity: line.quantity, availableQuantity: line.quantity, expiryDate: line.expiration, storageLocation: clean(line.storageLocation, "存放位置", 200), purchaseSource: input.merchant || "PURCHASE", purchasePrice: line.amount, unitPrice: line.unit ?? line.amount.div(line.quantity), status: "ACTIVE" } });
        await tx.inventoryLog.create({ data: { householdId: context.householdId, productCode: line.productCode, legacyBatchCode: entry.legacyBatchCode, actionType: "IN", quantity: line.quantity, beforeQuantity: 0, afterQuantity: line.quantity, reason: "PURCHASE", details: { version: 2, source: "PURCHASE", purchase_id: created.id, batches: [{ batch_code: entry.legacyBatchCode, quantity: line.quantity, before_quantity: 0, after_quantity: line.quantity, batch_updated_at: entry.updatedAt.toISOString() }] } } });
      }
      await writeAuditLog(tx, { action: "consumables.purchase.created", entityType: "ConsumablePurchase", entityId: created.id, actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId, afterData: { allocationId: input.transactionAllocationId, amount: formatMoney(total), itemCount: lines.length } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { id: purchase.id, amount: formatMoney(total) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError("CONFLICT", "该账本 Allocation 已经关联过采购记录。");
    throw error;
  }
}

async function lockEntries(tx: Prisma.TransactionClient, context: ActionContext, productCode: string, includeExpired: boolean) {
  const today = businessToday();
  return tx.$queryRaw<LockedEntry[]>(Prisma.sql`
    SELECT id, batch_code AS "legacyBatchCode", available_quantity AS "availableQuantity",
           expiry_date AS "expiryDate", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM inventory_batches
    WHERE household_id = ${context.householdId}::uuid
      AND product_code = ${productCode}
      AND status = 'ACTIVE'
      AND available_quantity > 0
      ${includeExpired ? Prisma.empty : Prisma.sql`AND (expiry_date IS NULL OR expiry_date >= ${today})`}
    ORDER BY expiry_date ASC NULLS LAST, created_at ASC, id ASC
    FOR UPDATE
  `);
}

function batchDetails(entries: LockedEntry[], changes: Array<{ id: number; beforeQuantity: number; afterQuantity: number; quantity: number }>, changedAt: Date): BatchChange[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return changes.map((change) => ({ batch_code: byId.get(change.id)!.legacyBatchCode, quantity: change.quantity, before_quantity: change.beforeQuantity, after_quantity: change.afterQuantity, batch_updated_at: changedAt.toISOString() }));
}

export async function consumeStock(context: ActionContext, input: { productCode: string; quantity: number }) {
  await authorize({ context, permission: "consumables.write" });
  const requested = quantity(input.quantity, "出库数量");
  const result = await getDatabase().$transaction(async (tx) => {
    if (!await tx.product.findFirst({ where: { productCode: input.productCode, householdId: context.householdId, isActive: 1 }, select: { productCode: true } })) throw new AppError("RESOURCE_NOT_FOUND", "产品不存在或已停用。");
    const entries = await lockEntries(tx, context, input.productCode, false);
    let changes;
    try { changes = planDeductions(entries, requested); } catch (error) { throw new AppError("CONFLICT", error instanceof Error ? error.message : "库存不足。"); }
    const changedAt = new Date();
    for (const change of changes) {
      const updated = await tx.stockEntry.updateMany({ where: { id: change.id, householdId: context.householdId, status: "ACTIVE", availableQuantity: change.beforeQuantity }, data: { availableQuantity: change.afterQuantity, updatedAt: changedAt } });
      if (updated.count !== 1) throw new AppError("CONFLICT", "库存状态已变化，请重试。");
    }
    const details = batchDetails(entries, changes, changedAt);
    const log = await tx.inventoryLog.create({ data: { householdId: context.householdId, productCode: input.productCode, legacyBatchCode: details.length === 1 ? details[0].batch_code : null, actionType: "OUT", quantity: requested, beforeQuantity: details.length === 1 ? details[0].before_quantity : null, afterQuantity: details.length === 1 ? details[0].after_quantity : null, details: { version: 2, batches: details } } });
    await writeAuditLog(tx, { action: "consumables.stock.consumed", entityType: "InventoryLog", entityId: String(log.id), actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId, afterData: { productCode: input.productCode, quantity: requested } });
    return { logId: log.id, deductions: details.map((item) => ({ stockEntryCode: item.batch_code, quantity: item.quantity })) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { ...result, productCode: input.productCode, quantity: requested, currentStock: await currentStock(input.productCode, context.householdId) };
}

export async function countStock(context: ActionContext, input: { productCode: string; targetQuantity: number; reason?: string }) {
  await authorize({ context, permission: "consumables.write" });
  if (!Number.isInteger(input.targetQuantity) || input.targetQuantity < 0 || input.targetQuantity > 99_999) throw new AppError("VALIDATION_FAILED", "盘点数量必须是 0 到 99999 的整数。");
  const result = await getDatabase().$transaction(async (tx) => {
    if (!await tx.product.findFirst({ where: { productCode: input.productCode, householdId: context.householdId, isActive: 1 }, select: { productCode: true } })) throw new AppError("RESOURCE_NOT_FOUND", "产品不存在或已停用。");
    const entries = await lockEntries(tx, context, input.productCode, true);
    if (!entries.length && input.targetQuantity > 0) {
      const created = await tx.stockEntry.create({ data: { householdId: context.householdId, legacyBatchCode: stockCode(input.productCode), productCode: input.productCode, initialQuantity: input.targetQuantity, availableQuantity: input.targetQuantity, purchaseSource: "ADJUSTMENT" } });
      const details: BatchChange[] = [{ batch_code: created.legacyBatchCode, quantity: input.targetQuantity, before_quantity: 0, after_quantity: input.targetQuantity, batch_updated_at: created.updatedAt.toISOString() }];
      const log = await tx.inventoryLog.create({ data: { householdId: context.householdId, productCode: input.productCode, legacyBatchCode: created.legacyBatchCode, actionType: "COUNT", quantity: input.targetQuantity, beforeQuantity: 0, afterQuantity: input.targetQuantity, reason: clean(input.reason, "盘点原因", 500), details: { version: 2, batches: details } } });
      await writeAuditLog(tx, { action: "consumables.stock.counted", entityType: "InventoryLog", entityId: String(log.id), actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId, beforeData: { quantity: 0 }, afterData: { quantity: input.targetQuantity } });
      return { logId: log.id };
    }
    let plan;
    try { plan = planInventoryCount(entries, input.targetQuantity); } catch (error) { throw new AppError("VALIDATION_FAILED", error instanceof Error ? error.message : "盘点数量不正确。"); }
    const changedAt = new Date();
    for (const change of plan.changes) await tx.stockEntry.update({ where: { id: change.id }, data: { availableQuantity: change.afterQuantity, initialQuantity: { increment: Math.max(change.afterQuantity - change.beforeQuantity, 0) }, updatedAt: changedAt } });
    const details = batchDetails(entries, plan.changes, changedAt);
    const log = await tx.inventoryLog.create({ data: { householdId: context.householdId, productCode: input.productCode, actionType: "COUNT", quantity: Math.abs(plan.difference), beforeQuantity: plan.currentQuantity, afterQuantity: input.targetQuantity, reason: clean(input.reason, "盘点原因", 500), details: { version: 2, batches: details } } });
    await writeAuditLog(tx, { action: "consumables.stock.counted", entityType: "InventoryLog", entityId: String(log.id), actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId, beforeData: { quantity: plan.currentQuantity }, afterData: { quantity: input.targetQuantity } });
    return { logId: log.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { ...result, productCode: input.productCode, quantity: input.targetQuantity, currentStock: await currentStock(input.productCode, context.householdId) };
}

function readChanges(details: Prisma.JsonValue | null): BatchChange[] {
  if (!details || typeof details !== "object" || Array.isArray(details) || !Array.isArray(details.batches)) return [];
  const changes: BatchChange[] = [];
  for (const value of details.batches) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    if (typeof item.batch_code !== "string" || !Number.isInteger(item.quantity) || !Number.isInteger(item.before_quantity) || !Number.isInteger(item.after_quantity) || typeof item.batch_updated_at !== "string") return [];
    changes.push({ batch_code: item.batch_code, quantity: item.quantity as number, before_quantity: item.before_quantity as number, after_quantity: item.after_quantity as number, batch_updated_at: item.batch_updated_at });
  }
  return changes;
}

export async function undoInventoryLog(context: ActionContext, logId: number) {
  await authorize({ context, permission: "consumables.write", resourceId: String(logId) });
  if (!Number.isInteger(logId) || logId <= 0) throw new AppError("VALIDATION_FAILED", "日志编号不正确。");
  const result = await getDatabase().$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM inventory_logs WHERE id = ${logId} AND household_id = ${context.householdId}::uuid FOR UPDATE`);
    const log = await tx.inventoryLog.findFirst({ where: { id: logId, householdId: context.householdId }, include: { reversal: { select: { id: true } } } });
    if (!log) throw new AppError("RESOURCE_NOT_FOUND", "库存日志不存在。");
    if (log.reversal) throw new AppError("CONFLICT", "该库存操作已经撤销。");
    if (!['IN', 'OUT'].includes(log.actionType)) throw new AppError("CONFLICT", "该库存操作不支持撤销。");
    if (log.reason === "PURCHASE") throw new AppError("CONFLICT", "采购入库需通过账本退款流程处理，不能单独撤销库存。");
    if (Date.now() - log.createdAt.getTime() > 30_000) throw new AppError("CONFLICT", "撤销窗口已超过 30 秒。");
    const changes = readChanges(log.details);
    if (!changes.length) throw new AppError("CONFLICT", "旧日志缺少可撤销的库存明细。");
    const sorted = changes.toSorted((left, right) => left.batch_code.localeCompare(right.batch_code));
    for (const change of sorted) {
      const rows = await tx.$queryRaw<LockedEntry[]>(Prisma.sql`
        SELECT id, batch_code AS "legacyBatchCode", available_quantity AS "availableQuantity", expiry_date AS "expiryDate", created_at AS "createdAt", updated_at AS "updatedAt"
        FROM inventory_batches WHERE household_id = ${context.householdId}::uuid AND batch_code = ${change.batch_code} FOR UPDATE
      `);
      const entry = rows[0];
      if (!entry || entry.availableQuantity !== change.after_quantity || entry.updatedAt.toISOString() !== change.batch_updated_at) throw new AppError("CONFLICT", "库存已经发生后续变化，不能撤销。");
      await tx.stockEntry.update({ where: { id: entry.id }, data: { availableQuantity: change.before_quantity, status: change.before_quantity === 0 && log.actionType === "IN" ? "INACTIVE" : "ACTIVE" } });
    }
    const reversal = await tx.inventoryLog.create({ data: { householdId: context.householdId, productCode: log.productCode, actionType: "UNDO", quantity: log.quantity, reason: `撤销日志 ${log.id}`, reversedLogId: log.id, details: { version: 2, original_log_id: log.id, batches: changes } } });
    await writeAuditLog(tx, { action: "consumables.stock.undone", entityType: "InventoryLog", entityId: String(reversal.id), actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId, afterData: { originalLogId: log.id } });
    return { logId: reversal.id, productCode: log.productCode, quantity: log.quantity };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { ...result, currentStock: await currentStock(result.productCode, context.householdId) };
}

export async function listLogs(context: ActionContext, limit = 50) {
  await authorize({ context, permission: "consumables.read" });
  const rows = await getDatabase().inventoryLog.findMany({ where: { householdId: context.householdId }, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(limit, 1), 200), include: { product: { select: { name: true } }, reversal: { select: { id: true } } } });
  return rows.map((row) => ({ id: row.id, productCode: row.productCode, productName: row.product.name, actionType: row.actionType, quantity: row.quantity, reason: row.reason, note: row.note, reversed: Boolean(row.reversal), createdAt: row.createdAt.toISOString() }));
}

export async function listStockEntries(context: ActionContext, filters: { productCode?: string; status?: string; attention?: boolean } = {}) {
  await authorize({ context, permission: "consumables.read" });
  const today = businessToday();
  const near = new Date(today.getTime() + 30 * 86_400_000);
  const rows = await getDatabase().stockEntry.findMany({
    where: { householdId: context.householdId, ...(filters.productCode ? { productCode: filters.productCode } : {}), ...(filters.status ? { status: filters.status } : {}), ...(filters.attention ? { availableQuantity: { gt: 0 }, expiryDate: { lte: near } } : {}) },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
    include: { product: { select: { name: true } } },
  });
  return rows.map((row) => ({ id: row.id, stockEntryCode: row.legacyBatchCode, productCode: row.productCode, productName: row.product.name, initialQuantity: row.initialQuantity, availableQuantity: row.availableQuantity, expiresOn: row.expiryDate ? row.expiryDate.toISOString().slice(0, 10) as `${number}-${number}-${number}` : null, storageLocation: row.storageLocation, source: row.purchaseSource, status: row.status, createdAt: row.createdAt.toISOString() }));
}

export async function adjustStockEntry(context: ActionContext, id: number, input: { type: "add" | "remove" | "set"; quantity: number; reason?: string; note?: string }) {
  await authorize({ context, permission: "consumables.write", resourceId: String(id) });
  const requested = quantity(input.quantity, "调整数量");
  const result = await getDatabase().$transaction(async (tx) => {
    const rows = await tx.$queryRaw<LockedEntry[]>(Prisma.sql`SELECT id, batch_code AS "legacyBatchCode", available_quantity AS "availableQuantity", expiry_date AS "expiryDate", created_at AS "createdAt", updated_at AS "updatedAt" FROM inventory_batches WHERE id = ${id} AND household_id = ${context.householdId}::uuid FOR UPDATE`);
    const entry = rows[0];
    if (!entry) throw new AppError("RESOURCE_NOT_FOUND", "库存记录不存在。");
    const before = entry.availableQuantity;
    const after = input.type === "add" ? before + requested : input.type === "remove" ? before - requested : requested;
    if (after < 0 || after > 99_999) throw new AppError("VALIDATION_FAILED", "调整后的库存必须在 0 到 99999 之间。");
    const changedAt = new Date();
    await tx.stockEntry.update({ where: { id }, data: { availableQuantity: after, initialQuantity: { increment: Math.max(after - before, 0) }, updatedAt: changedAt } });
    const log = await tx.inventoryLog.create({ data: { householdId: context.householdId, productCode: (await tx.stockEntry.findUnique({ where: { id }, select: { productCode: true } }))!.productCode, legacyBatchCode: entry.legacyBatchCode, actionType: "ADJUST", quantity: Math.abs(after - before), beforeQuantity: before, afterQuantity: after, reason: clean(input.reason, "调整原因", 500), note: clean(input.note, "备注"), details: { version: 2, batches: [{ batch_code: entry.legacyBatchCode, quantity: Math.abs(after - before), before_quantity: before, after_quantity: after, batch_updated_at: changedAt.toISOString() }] } } });
    return { logId: log.id, productCode: log.productCode };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { ...result, quantity: requested, currentStock: await currentStock(result.productCode, context.householdId) };
}

export async function listProductGroups(context: ActionContext) {
  await authorize({ context, permission: "consumables.read" });
  const rows = await getDatabase().productGroup.findMany({ where: { householdId: context.householdId, isActive: 1 }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], include: { _count: { select: { items: true } } } });
  return rows.map((row) => ({ groupCode: row.groupCode, name: row.name, description: row.description, itemCount: row._count.items }));
}

async function nextGroupCode() {
  const rows = await getDatabase().productGroup.findMany({ select: { groupCode: true } });
  let max = 0;
  for (const row of rows) { const match = row.groupCode.match(/^PG(\d+)$/i); if (match) max = Math.max(max, Number(match[1])); }
  return `PG${String(max + 1).padStart(3, "0")}`;
}

export async function createProductGroup(context: ActionContext, input: { name: string; description?: string; sortOrder?: number }) {
  await authorize({ context, permission: "consumables.write" });
  const name = clean(input.name, "产品组名称", 200);
  if (!name) throw new AppError("VALIDATION_FAILED", "产品组名称必填。");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const groupCode = await nextGroupCode();
      const tokenHash = createHash("sha256").update(crypto.randomUUID()).digest("hex");
      const group = await getDatabase().productGroup.create({ data: { householdId: context.householdId, groupCode, name, description: clean(input.description, "描述"), qrTokenHash: tokenHash, sortOrder: input.sortOrder ?? 0 } });
      return { groupCode: group.groupCode, name: group.name, description: group.description, itemCount: 0 };
    } catch (error) {
      if (attempt < 4 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new AppError("CONFLICT", "产品组编码生成失败，请重试。");
}

export async function addProductGroupItem(context: ActionContext, groupCode: string, input: { productCode: string; suggestedQuantity?: number; note?: string; sortOrder?: number }) {
  await authorize({ context, permission: "consumables.write" });
  const suggestedQuantity = input.suggestedQuantity ?? 1;
  quantity(suggestedQuantity, "建议数量");
  const [group, product] = await Promise.all([
    getDatabase().productGroup.findFirst({ where: { groupCode, householdId: context.householdId, isActive: 1 }, select: { groupCode: true } }),
    getDatabase().product.findFirst({ where: { productCode: input.productCode, householdId: context.householdId, isActive: 1 }, select: { productCode: true } }),
  ]);
  if (!group || !product) throw new AppError("RESOURCE_NOT_FOUND", "产品组或产品不存在。");
  try {
    const item = await getDatabase().productGroupItem.create({ data: { householdId: context.householdId, groupCode, productCode: input.productCode, suggestedQty: suggestedQuantity, note: clean(input.note, "备注"), sortOrder: input.sortOrder ?? 0 } });
    return { id: item.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError("CONFLICT", "产品已经在该产品组中。");
    throw error;
  }
}

export const consumablesService = { listProducts, createProduct, getSummary, receiveStock, createPurchase, consumeStock, countStock, undoInventoryLog, listLogs, listStockEntries, adjustStockEntry, listProductGroups, createProductGroup, addProductGroupItem };
