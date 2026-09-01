import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { authorize } from "@/lib/auth/authorization";
import { getDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors/app-error";
import type { ActionContext } from "@/lib/types/platform";
import { formatMoney } from "@/modules/ledger/money";
import { parseOccurredAt, validateAllocations } from "@/modules/ledger/validation";
import { compositeRefundSchema } from "./schemas";
import { clean, createIdempotencyRow, isRetryableTransaction, readIdempotentResponse, requestHash, validateCompositeReferences } from "./shared";
import type { CompositeRefundResult, CreateCompositeRefundInput } from "./types";

const scope = "refund-orchestrator.v1";
const allocationKey = (module: string, categoryId?: string | null) => `${module}:${categoryId ?? "uncategorized"}`;

export async function createCompositeRefund(context: ActionContext, rawInput: CreateCompositeRefundInput): Promise<CompositeRefundResult> {
  const parsed = compositeRefundSchema.safeParse(rawInput);
  if (!parsed.success) throw new AppError("VALIDATION_FAILED", "退款参数不正确。", parsed.error.flatten());
  const input = parsed.data as CreateCompositeRefundInput;
  await authorize({ context, permission: "ledger.write", resourceId: input.originalTransactionId });
  const normalized = validateAllocations(input.amount, input.allocations);
  await validateCompositeReferences(context, undefined, input.allocations);
  const hash = requestHash(input);
  const replay = await readIdempotentResponse<Omit<CompositeRefundResult, "replayed">>(context, scope, input.idempotencyKey, hash);
  if (replay) return replay;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await getDatabase().$transaction(async (tx) => {
        await createIdempotencyRow(tx, context, scope, input.idempotencyKey, hash);
        await tx.$queryRaw`SELECT "id" FROM "transactions" WHERE "id" = ${input.originalTransactionId}::uuid FOR UPDATE`;
        const original = await tx.transaction.findFirst({ where: { id: input.originalTransactionId, householdId: context.householdId, type: "EXPENSE", deletedAt: null }, select: { id: true, amount: true, currency: true, paymentAccountId: true, merchant: true, allocations: { select: { module: true, categoryId: true, amount: true } } } });
        if (!original) throw new AppError("RESOURCE_NOT_FOUND", "原支出账目不存在。");
        const previous = await tx.transaction.findMany({ where: { refundOfTransactionId: original.id, deletedAt: null }, select: { amount: true, allocations: { select: { module: true, categoryId: true, amount: true } } } });
        const refunded = previous.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
        if (normalized.total.greaterThan(original.amount.sub(refunded))) throw new AppError("VALIDATION_FAILED", "退款金额超过原账目剩余可退金额。");
        const available = new Map<string, Prisma.Decimal>();
        for (const item of original.allocations) available.set(allocationKey(item.module, item.categoryId), (available.get(allocationKey(item.module, item.categoryId)) ?? new Prisma.Decimal(0)).add(item.amount));
        for (const refund of previous) for (const item of refund.allocations) available.set(allocationKey(item.module, item.categoryId), (available.get(allocationKey(item.module, item.categoryId)) ?? new Prisma.Decimal(0)).sub(item.amount));
        const requested = new Map<string, Prisma.Decimal>();
        for (const item of normalized.allocations) requested.set(allocationKey(item.module, item.categoryId), (requested.get(allocationKey(item.module, item.categoryId)) ?? new Prisma.Decimal(0)).add(item.amount));
        for (const [key, amount] of requested) if (amount.greaterThan(available.get(key) ?? 0)) throw new AppError("VALIDATION_FAILED", "退款拆分超过原用途的可退金额。");
        const transaction = await tx.transaction.create({ data: { householdId: context.householdId, createdByUserId: context.userId, type: "REFUND", refundOfTransactionId: original.id, amount: normalized.total, currency: original.currency, transactionAt: parseOccurredAt(input.occurredAt), paymentAccountId: original.paymentAccountId, merchant: original.merchant, note: clean(input.note) }, select: { id: true } });
        const allocationIds: string[] = [];
        for (const item of normalized.allocations) allocationIds.push((await tx.transactionAllocation.create({ data: { householdId: context.householdId, transactionId: transaction.id, module: item.module, categoryId: item.categoryId, amount: item.amount, note: item.note }, select: { id: true } })).id);
        const response = { transactionId: transaction.id, originalTransactionId: original.id, amount: formatMoney(normalized.total), allocationIds };
        await writeAuditLog(tx, { action: "orchestration.refund.created", entityType: "Transaction", entityId: transaction.id, actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId, afterData: { originalTransactionId: original.id, amount: response.amount } });
        await tx.idempotencyKey.update({ where: { householdId_scope_key: { householdId: context.householdId, scope, key: input.idempotencyKey } }, data: { responseStatus: 201, responseBody: response } });
        return { ...response, replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const replayed = await readIdempotentResponse<Omit<CompositeRefundResult, "replayed">>(context, scope, input.idempotencyKey, hash);
      if (replayed) return replayed;
      if (attempt < 2 && isRetryableTransaction(error)) continue;
      throw error;
    }
  }
  throw new AppError("CONFLICT", "退款并发冲突，请重试。");
}
