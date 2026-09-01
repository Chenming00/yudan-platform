import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { ActionContext, CursorPage } from "@/lib/types/platform";
import { writeAuditLog } from "@/lib/auth/audit";
import { authorize } from "@/lib/auth/authorization";
import { getDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors/app-error";
import { decodeLedgerCursor, encodeLedgerCursor } from "@/modules/ledger/cursor";
import { formatMoney } from "@/modules/ledger/money";
import type {
  CreateRefundInput,
  CreateTransactionInput,
  ExpenseModule,
  LedgerListFilters,
  LedgerOptions,
  LedgerSummary,
  LedgerTransaction,
  UpdateTransactionInput,
} from "@/modules/ledger/types";
import {
  assertCategoryCompatibility,
  normalizeNullableText,
  parseOccurredAt,
  validateAllocations,
} from "@/modules/ledger/validation";

const transactionSelect = {
  id: true,
  type: true,
  amount: true,
  currency: true,
  transactionAt: true,
  merchant: true,
  note: true,
  refundOfTransactionId: true,
  paymentAccount: { select: { id: true, name: true } },
  allocations: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      module: true,
      amount: true,
      note: true,
      category: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.TransactionSelect;

type SelectedTransaction = Prisma.TransactionGetPayload<{ select: typeof transactionSelect }>;

function serializeTransaction(transaction: SelectedTransaction): LedgerTransaction {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: formatMoney(transaction.amount),
    currency: transaction.currency,
    occurredAt: transaction.transactionAt.toISOString(),
    paymentAccount: transaction.paymentAccount,
    merchant: transaction.merchant,
    note: transaction.note,
    refundOfTransactionId: transaction.refundOfTransactionId,
    allocations: transaction.allocations.map((allocation) => ({
      id: allocation.id,
      module: allocation.module,
      category: allocation.category,
      amount: formatMoney(allocation.amount),
      note: allocation.note,
    })),
  };
}

async function validateReferences(
  householdId: string,
  paymentAccountId: string | null | undefined,
  allocations: Array<{ module: string; categoryId?: string }>,
) {
  const db = getDatabase();
  const categoryIds = [...new Set(allocations.flatMap((item) => item.categoryId ? [item.categoryId] : []))];
  const [categories, account] = await Promise.all([
    categoryIds.length
      ? db.category.findMany({
          where: { id: { in: categoryIds }, householdId, isActive: true },
          select: { id: true, module: true },
        })
      : [],
    paymentAccountId
      ? db.paymentAccount.findFirst({
          where: { id: paymentAccountId, householdId, isActive: true },
          select: { id: true },
        })
      : null,
  ]);
  assertCategoryCompatibility(allocations, categories);
  if (paymentAccountId && !account) {
    throw new AppError("VALIDATION_FAILED", "支付账户不存在或不可用。" );
  }
}

export async function createTransaction(
  context: ActionContext,
  input: CreateTransactionInput,
) {
  await authorize({ context, permission: "ledger.write" });
  const normalized = validateAllocations(input.amount, input.allocations);
  const transactionAt = parseOccurredAt(input.occurredAt);
  const merchant = normalizeNullableText(input.merchant ?? input.payee);
  const note = normalizeNullableText(input.note);
  await validateReferences(context.householdId, input.paymentAccountId, normalized.allocations);

  const db = getDatabase();
  const created = await db.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        householdId: context.householdId,
        createdByUserId: context.userId,
        type: input.type,
        amount: normalized.total,
        transactionAt,
        paymentAccountId: input.paymentAccountId || null,
        merchant,
        note,
        allocations: {
          create: normalized.allocations.map((allocation) => ({
            householdId: context.householdId,
            module: allocation.module,
            categoryId: allocation.categoryId,
            amount: allocation.amount,
            note: allocation.note,
          })),
        },
      },
      select: transactionSelect,
    });
    await writeAuditLog(tx, {
      action: "ledger.transaction.created",
      entityType: "Transaction",
      entityId: transaction.id,
      actorUserId: context.userId,
      householdId: context.householdId,
      requestId: context.requestId,
      afterData: { type: input.type, amount: formatMoney(normalized.total) },
    });
    return transaction;
  });
  return serializeTransaction(created);
}

export async function updateTransaction(
  context: ActionContext,
  id: string,
  input: UpdateTransactionInput,
) {
  await authorize({ context, permission: "ledger.write", resourceId: id });
  const normalized = validateAllocations(input.amount, input.allocations);
  const transactionAt = parseOccurredAt(input.occurredAt);
  await validateReferences(context.householdId, input.paymentAccountId, normalized.allocations);
  const db = getDatabase();

  const updated = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "transactions" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const existing = await tx.transaction.findFirst({
      where: { id, householdId: context.householdId, deletedAt: null },
      select: { id: true, type: true, amount: true },
    });
    if (!existing) throw new AppError("RESOURCE_NOT_FOUND", "账目不存在。" );
    if (existing.type === "REFUND") {
      throw new AppError("CONFLICT", "退款记录不可直接修改；可先撤销退款再重新创建。" );
    }
    const activeRefunds = await tx.transaction.count({
      where: { refundOfTransactionId: id, deletedAt: null },
    });
    if (activeRefunds > 0) {
      throw new AppError("CONFLICT", "已有退款的原账目不可修改。" );
    }

    await tx.transactionAllocation.deleteMany({ where: { transactionId: id } });
    const transaction = await tx.transaction.update({
      where: { id },
      data: {
        amount: normalized.total,
        transactionAt,
        paymentAccountId: input.paymentAccountId || null,
        merchant: normalizeNullableText(input.merchant),
        note: normalizeNullableText(input.note),
        allocations: {
          create: normalized.allocations.map((allocation) => ({
            householdId: context.householdId,
            module: allocation.module,
            categoryId: allocation.categoryId,
            amount: allocation.amount,
            note: allocation.note,
          })),
        },
      },
      select: transactionSelect,
    });
    await writeAuditLog(tx, {
      action: "ledger.transaction.updated",
      entityType: "Transaction",
      entityId: id,
      actorUserId: context.userId,
      householdId: context.householdId,
      requestId: context.requestId,
      beforeData: { amount: formatMoney(existing.amount) },
      afterData: { amount: formatMoney(normalized.total) },
    });
    return transaction;
  });
  return serializeTransaction(updated);
}

export async function createRefund(context: ActionContext, input: CreateRefundInput) {
  await authorize({ context, permission: "ledger.write", resourceId: input.originalTransactionId });
  const normalized = validateAllocations(input.amount, input.allocations);
  const transactionAt = parseOccurredAt(input.occurredAt);
  await validateReferences(context.householdId, null, normalized.allocations);
  const db = getDatabase();

  const refund = await db.$transaction(async (tx) => {
    // Serializes concurrent refunds so their combined amount cannot exceed the original expense.
    await tx.$queryRaw`SELECT "id" FROM "transactions" WHERE "id" = ${input.originalTransactionId}::uuid FOR UPDATE`;
    const original = await tx.transaction.findFirst({
      where: {
        id: input.originalTransactionId,
        householdId: context.householdId,
        type: "EXPENSE",
        deletedAt: null,
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        paymentAccountId: true,
        merchant: true,
        allocations: { select: { module: true, categoryId: true, amount: true } },
      },
    });
    if (!original) throw new AppError("RESOURCE_NOT_FOUND", "原支出账目不存在。" );
    const previous = await tx.transaction.aggregate({
      where: { refundOfTransactionId: original.id, deletedAt: null },
      _sum: { amount: true },
    });
    const available = original.amount.sub(previous._sum.amount ?? 0);
    if (normalized.total.greaterThan(available)) {
      throw new AppError("VALIDATION_FAILED", `最多可退款 ${formatMoney(available)}。`);
    }

    const previousAllocations = await tx.transactionAllocation.findMany({
      where: {
        transaction: { refundOfTransactionId: original.id, deletedAt: null },
      },
      select: { module: true, categoryId: true, amount: true },
    });
    const allocationKey = (module: string, categoryId: string | null | undefined) =>
      `${module}:${categoryId ?? "uncategorized"}`;
    const availableByAllocation = new Map<string, Prisma.Decimal>();
    for (const allocation of original.allocations) {
      const key = allocationKey(allocation.module, allocation.categoryId);
      availableByAllocation.set(
        key,
        (availableByAllocation.get(key) ?? new Prisma.Decimal(0)).add(allocation.amount),
      );
    }
    for (const allocation of previousAllocations) {
      const key = allocationKey(allocation.module, allocation.categoryId);
      availableByAllocation.set(
        key,
        (availableByAllocation.get(key) ?? new Prisma.Decimal(0)).sub(allocation.amount),
      );
    }
    const requestedByAllocation = new Map<string, Prisma.Decimal>();
    for (const allocation of normalized.allocations) {
      const key = allocationKey(allocation.module, allocation.categoryId);
      requestedByAllocation.set(
        key,
        (requestedByAllocation.get(key) ?? new Prisma.Decimal(0)).add(allocation.amount),
      );
    }
    for (const [key, requested] of requestedByAllocation) {
      if (requested.greaterThan(availableByAllocation.get(key) ?? 0)) {
        throw new AppError("VALIDATION_FAILED", "退款拆分超过原账目对应用途的可退金额。" );
      }
    }

    const created = await tx.transaction.create({
      data: {
        householdId: context.householdId,
        createdByUserId: context.userId,
        type: "REFUND",
        refundOfTransactionId: original.id,
        amount: normalized.total,
        currency: original.currency,
        transactionAt,
        paymentAccountId: original.paymentAccountId,
        merchant: original.merchant,
        note: normalizeNullableText(input.note),
        allocations: {
          create: normalized.allocations.map((allocation) => ({
            householdId: context.householdId,
            module: allocation.module,
            categoryId: allocation.categoryId,
            amount: allocation.amount,
            note: allocation.note,
          })),
        },
      },
      select: transactionSelect,
    });
    await writeAuditLog(tx, {
      action: "ledger.transaction.refunded",
      entityType: "Transaction",
      entityId: created.id,
      actorUserId: context.userId,
      householdId: context.householdId,
      requestId: context.requestId,
      afterData: { originalTransactionId: original.id, amount: formatMoney(normalized.total) },
    });
    return created;
  });
  return serializeTransaction(refund);
}

export async function deleteTransaction(context: ActionContext, id: string) {
  await authorize({ context, permission: "ledger.write", resourceId: id });
  const db = getDatabase();
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "transactions" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const existing = await tx.transaction.findFirst({
      where: { id, householdId: context.householdId, deletedAt: null },
      select: { id: true, type: true, amount: true },
    });
    if (!existing) throw new AppError("RESOURCE_NOT_FOUND", "账目不存在。" );
    if (existing.type === "EXPENSE") {
      const refunds = await tx.transaction.count({ where: { refundOfTransactionId: id, deletedAt: null } });
      if (refunds > 0) throw new AppError("CONFLICT", "已有退款的原账目不能删除。" );
    }
    await tx.transaction.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog(tx, {
      action: "ledger.transaction.deleted",
      entityType: "Transaction",
      entityId: id,
      actorUserId: context.userId,
      householdId: context.householdId,
      requestId: context.requestId,
      beforeData: { type: existing.type, amount: formatMoney(existing.amount) },
    });
  });
}

export async function getTransaction(context: ActionContext, id: string) {
  await authorize({ context, permission: "ledger.read", resourceId: id });
  const db = getDatabase();
  const transaction = await db.transaction.findFirst({
    where: { id, householdId: context.householdId, deletedAt: null },
    select: transactionSelect,
  });
  return transaction ? serializeTransaction(transaction) : null;
}

export async function listTransactions(
  context: ActionContext,
  filters: LedgerListFilters = {},
): Promise<CursorPage<LedgerTransaction>> {
  await authorize({ context, permission: "ledger.read" });
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const cursor = filters.cursor ? decodeLedgerCursor(filters.cursor) : null;
  const cursorDate = cursor ? new Date(cursor.transactionAt) : null;
  const where: Prisma.TransactionWhereInput = {
    householdId: context.householdId,
    deletedAt: null,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.module ? { allocations: { some: { module: filters.module } } } : {}),
    ...(filters.query?.trim()
      ? {
          OR: [
            { merchant: { contains: filters.query.trim(), mode: "insensitive" } },
            { note: { contains: filters.query.trim(), mode: "insensitive" } },
          ],
        }
      : {}),
    ...((filters.from || filters.to)
      ? {
          transactionAt: {
            ...(filters.from ? { gte: parseOccurredAt(filters.from) } : {}),
            ...(filters.to ? { lt: parseOccurredAt(filters.to) } : {}),
          },
        }
      : {}),
    ...(cursor && cursorDate
      ? {
          AND: [
            {
              OR: [
                { transactionAt: { lt: cursorDate } },
                { transactionAt: cursorDate, id: { gt: cursor.id } },
              ],
            },
          ],
        }
      : {}),
  };
  const db = getDatabase();
  const rows = await db.transaction.findMany({
    where,
    orderBy: [{ transactionAt: "desc" }, { id: "asc" }],
    take: limit + 1,
    select: transactionSelect,
  });
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows.at(-1);
  return {
    items: pageRows.map(serializeTransaction),
    nextCursor: hasMore && last
      ? encodeLedgerCursor({ transactionAt: last.transactionAt.toISOString(), id: last.id })
      : null,
  };
}

function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new AppError("VALIDATION_FAILED", "月份格式必须为 YYYY-MM。" );
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(`${month}-01T00:00:00+08:00`);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+08:00`);
  return { start, end };
}

export async function getLedgerSummary(context: ActionContext, month: string): Promise<LedgerSummary> {
  await authorize({ context, permission: "ledger.read" });
  const { start, end } = monthRange(month);
  const db = getDatabase();
  const rows = await db.transaction.findMany({
    where: { householdId: context.householdId, deletedAt: null, transactionAt: { gte: start, lt: end } },
    select: {
      type: true,
      amount: true,
      transactionAt: true,
      allocations: {
        select: { module: true, amount: true, categoryId: true, category: { select: { name: true } } },
      },
    },
  });

  let income = new Prisma.Decimal(0);
  let expense = new Prisma.Decimal(0);
  let refunds = new Prisma.Decimal(0);
  const modules = new Map<ExpenseModule, Prisma.Decimal>();
  const categories = new Map<string, { categoryId: string | null; name: string; amount: Prisma.Decimal }>();
  const days = new Map<string, { income: Prisma.Decimal; expense: Prisma.Decimal; refunds: Prisma.Decimal }>();
  const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });

  for (const row of rows) {
    if (row.type === "INCOME") income = income.add(row.amount);
    if (row.type === "EXPENSE") expense = expense.add(row.amount);
    if (row.type === "REFUND") refunds = refunds.add(row.amount);
    const date = dayFormatter.format(row.transactionAt);
    const day = days.get(date) ?? { income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0), refunds: new Prisma.Decimal(0) };
    day[row.type === "INCOME" ? "income" : row.type === "EXPENSE" ? "expense" : "refunds"] = day[row.type === "INCOME" ? "income" : row.type === "EXPENSE" ? "expense" : "refunds"].add(row.amount);
    days.set(date, day);

    const sign = row.type === "REFUND" ? new Prisma.Decimal(-1) : row.type === "EXPENSE" ? new Prisma.Decimal(1) : new Prisma.Decimal(0);
    if (!sign.isZero()) for (const allocation of row.allocations) {
      const signed = allocation.amount.mul(sign);
      modules.set(allocation.module, (modules.get(allocation.module) ?? new Prisma.Decimal(0)).add(signed));
      const key = allocation.categoryId ?? `${allocation.module}:uncategorized`;
      const category = categories.get(key) ?? { categoryId: allocation.categoryId, name: allocation.category?.name ?? "未分类", amount: new Prisma.Decimal(0) };
      category.amount = category.amount.add(signed);
      categories.set(key, category);
    }
  }
  const netExpense = expense.sub(refunds);
  return {
    month,
    income: formatMoney(income),
    expense: formatMoney(expense),
    refunds: formatMoney(refunds),
    netExpense: formatMoney(netExpense),
    balance: formatMoney(income.sub(netExpense)),
    transactionCount: rows.length,
    byModule: [...modules.entries()].map(([module, amount]) => ({ module, amount: formatMoney(amount) })),
    byCategory: [...categories.values()]
      .sort((a, b) => b.amount.comparedTo(a.amount))
      .map((item) => ({ ...item, amount: formatMoney(item.amount) })),
    byDay: [...days.entries()].map(([date, value]) => ({ date, income: formatMoney(value.income), expense: formatMoney(value.expense), refunds: formatMoney(value.refunds) })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export async function getLedgerOptions(context: ActionContext): Promise<LedgerOptions> {
  await authorize({ context, permission: "ledger.read" });
  const db = getDatabase();
  const [categories, paymentAccounts] = await Promise.all([
    db.category.findMany({
      where: { householdId: context.householdId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, module: true },
    }),
    db.paymentAccount.findMany({
      where: { householdId: context.householdId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
  ]);
  return { categories, paymentAccounts };
}

export const ledgerService = {
  createTransaction,
  updateTransaction,
  createRefund,
  deleteTransaction,
  getTransaction,
  listTransactions,
  getLedgerSummary,
  getLedgerOptions,
};
