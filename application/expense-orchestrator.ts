import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { getDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors/app-error";
import type { ActionContext } from "@/lib/types/platform";
import { parseBusinessDate } from "@/modules/consumables/date";
import { formatMoney } from "@/modules/ledger/money";
import { parseOccurredAt, validateAllocations } from "@/modules/ledger/validation";
import { compositeExpenseSchema } from "./schemas";
import { authorizeCompositeExpense, clean, createIdempotencyRow, isRetryableTransaction, readIdempotentResponse, requestHash, stockCode, validateCompositeReferences } from "./shared";
import type { CompositeExpenseResult, CreateCompositeExpenseInput } from "./types";

const scope = "expense-orchestrator.v1";

function wardrobeItemData(householdId: string, item: NonNullable<CreateCompositeExpenseInput["allocations"][number]["wardrobe"]>["items"][number]) {
  return { householdId, babyProfileId: item.babyProfileId || null, name: item.name.trim().slice(0, 200), category: clean(item.category, 100), size: clean(item.size, 100), season: clean(item.season, 100), color: clean(item.color, 100), quantity: item.quantity ?? 1, note: clean(item.note) };
}

export async function createCompositeExpense(context: ActionContext, rawInput: CreateCompositeExpenseInput): Promise<CompositeExpenseResult> {
  const parsed = compositeExpenseSchema.safeParse(rawInput);
  if (!parsed.success) throw new AppError("VALIDATION_FAILED", "组合记账参数不正确。", parsed.error.flatten());
  const input = parsed.data as CreateCompositeExpenseInput;
  await authorizeCompositeExpense(context, input.allocations);
  const normalized = validateAllocations(input.amount, input.allocations);
  const occurredAt = parseOccurredAt(input.occurredAt);
  const productNames = await validateCompositeReferences(context, input.paymentAccountId, input.allocations);
  for (const allocation of input.allocations) if (allocation.consumables) {
    const lineTotal = allocation.consumables.items.reduce((sum, item) => sum.add(new Prisma.Decimal(item.lineAmount)), new Prisma.Decimal(0));
    if (!lineTotal.equals(new Prisma.Decimal(allocation.amount))) throw new AppError("VALIDATION_FAILED", "每条消耗品采购明细合计必须等于对应拆分金额。");
  }
  const hash = requestHash(input);
  const replay = await readIdempotentResponse<Omit<CompositeExpenseResult, "replayed">>(context, scope, input.idempotencyKey, hash);
  if (replay) return replay;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await getDatabase().$transaction(async (tx) => {
        await createIdempotencyRow(tx, context, scope, input.idempotencyKey, hash);
        const transaction = await tx.transaction.create({ data: { householdId: context.householdId, createdByUserId: context.userId, type: "EXPENSE", amount: normalized.total, transactionAt: occurredAt, paymentAccountId: input.paymentAccountId || null, merchant: clean(input.merchant), note: clean(input.note) }, select: { id: true } });
        const allocationIds: string[] = [];
        const businessRecordIds: CompositeExpenseResult["businessRecordIds"] = [];
        for (let index = 0; index < input.allocations.length; index++) {
          const item = input.allocations[index];
          const normalizedItem = normalized.allocations[index];
          const allocation = await tx.transactionAllocation.create({ data: { householdId: context.householdId, transactionId: transaction.id, module: normalizedItem.module, categoryId: normalizedItem.categoryId, amount: normalizedItem.amount, note: normalizedItem.note }, select: { id: true } });
          allocationIds.push(allocation.id);
          if (item.care) {
            const record = await tx.careRecord.create({ data: { householdId: context.householdId, babyProfileId: item.care.babyProfileId, transactionAllocationId: allocation.id, type: item.care.type, occurredAt: new Date(item.care.occurredAt), title: item.care.title.trim(), provider: clean(item.care.provider), note: clean(item.care.note) }, select: { id: true } });
            businessRecordIds.push({ module: "CHILD_CARE", allocationId: allocation.id, recordId: record.id });
          }
          if (item.wardrobe) {
            const purchase = await tx.wardrobePurchase.create({ data: { householdId: context.householdId, transactionAllocationId: allocation.id, purchasedAt: occurredAt, merchant: clean(input.merchant, 300), note: clean(item.note), items: { create: item.wardrobe.items.map((wardrobe) => wardrobeItemData(context.householdId, wardrobe)) } }, select: { id: true } });
            businessRecordIds.push({ module: "WARDROBE", allocationId: allocation.id, recordId: purchase.id });
          }
          if (item.consumables) {
            const purchase = await tx.consumablePurchase.create({ data: { householdId: context.householdId, transactionAllocationId: allocation.id, purchasedAt: occurredAt, merchant: clean(input.merchant, 300), note: clean(item.note) }, select: { id: true } });
            for (const product of item.consumables.items) {
              const quantity = product.quantity;
              const amount = new Prisma.Decimal(product.lineAmount);
              const purchaseItem = await tx.consumablePurchaseItem.create({ data: { householdId: context.householdId, consumablePurchaseId: purchase.id, productCode: product.productCode, description: clean(product.description, 300) ?? productNames.get(product.productCode) ?? product.productCode, quantity, unitPrice: product.unitPrice ? new Prisma.Decimal(product.unitPrice) : amount.div(quantity), lineAmount: amount }, select: { id: true } });
              const entry = await tx.stockEntry.create({ data: { householdId: context.householdId, legacyBatchCode: stockCode(product.productCode), productCode: product.productCode, purchaseItemId: purchaseItem.id, initialQuantity: quantity, availableQuantity: quantity, expiryDate: product.expiresOn ? parseBusinessDate(product.expiresOn) : null, storageLocation: clean(product.storageLocation, 200), purchaseSource: input.merchant || "PURCHASE", purchasePrice: amount, unitPrice: product.unitPrice ? new Prisma.Decimal(product.unitPrice) : amount.div(quantity) } });
              await tx.inventoryLog.create({ data: { householdId: context.householdId, productCode: product.productCode, legacyBatchCode: entry.legacyBatchCode, actionType: "IN", quantity, beforeQuantity: 0, afterQuantity: quantity, reason: "PURCHASE", details: { version: 2, source: "PURCHASE", purchase_id: purchase.id, batches: [{ batch_code: entry.legacyBatchCode, quantity, before_quantity: 0, after_quantity: quantity, batch_updated_at: entry.updatedAt.toISOString() }] } } });
            }
            businessRecordIds.push({ module: "CONSUMABLES", allocationId: allocation.id, recordId: purchase.id });
          }
        }
        const response = { transactionId: transaction.id, amount: formatMoney(normalized.total), allocationIds, businessRecordIds };
        await writeAuditLog(tx, { action: "orchestration.expense.created", entityType: "Transaction", entityId: transaction.id, actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId, afterData: { amount: response.amount, allocations: allocationIds.length, businessRecords: businessRecordIds.length } });
        await tx.idempotencyKey.update({ where: { householdId_scope_key: { householdId: context.householdId, scope, key: input.idempotencyKey } }, data: { responseStatus: 201, responseBody: response } });
        return { ...response, replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return result;
    } catch (error) {
      const replayed = await readIdempotentResponse<Omit<CompositeExpenseResult, "replayed">>(context, scope, input.idempotencyKey, hash);
      if (replayed) return replayed;
      if (attempt < 2 && isRetryableTransaction(error)) continue;
      throw error;
    }
  }
  throw new AppError("CONFLICT", "组合记账并发冲突，请重试。");
}
