import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { authorize } from "@/lib/auth/authorization";
import { getDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors/app-error";
import type { ActionContext } from "@/lib/types/platform";
import { businessToday } from "@/modules/consumables/date";
import { formatMoney } from "@/modules/ledger/money";
import type { ExpenseModule } from "@/modules/ledger/types";
import type { PermissionCode } from "@/modules/auth/types";
import type { DashboardEvent, DashboardOverview } from "./types";

const modules: ExpenseModule[] = ["CHILD_CARE", "WARDROBE", "CONSUMABLES", "OTHER"];

function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new AppError("VALIDATION_FAILED", "月份格式必须为 YYYY-MM。");
  const [year, value] = month.split("-").map(Number);
  const nextYear = value === 12 ? year + 1 : year;
  const nextMonth = value === 12 ? 1 : value + 1;
  return { start: new Date(`${month}-01T00:00:00+08:00`), end: new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+08:00`) };
}

export async function getDashboardOverview(context: ActionContext, month: string): Promise<DashboardOverview> {
  const permissions: PermissionCode[] = ["ledger.read", "care.read", "wardrobe.read", "consumables.read"];
  await Promise.all(permissions.map((permission) => authorize({ context, permission })));
  const { start, end } = monthRange(month);
  const db = getDatabase();
  const [transactions, care, wardrobe, inventory, products] = await Promise.all([
    db.transaction.findMany({ where: { householdId: context.householdId, deletedAt: null, transactionAt: { gte: start, lt: end } }, orderBy: { transactionAt: "desc" }, select: { id: true, type: true, amount: true, transactionAt: true, merchant: true, allocations: { select: { module: true, amount: true } } } }),
    db.careRecord.findMany({ where: { householdId: context.householdId }, orderBy: { occurredAt: "desc" }, take: 8, select: { id: true, title: true, provider: true, occurredAt: true } }),
    db.wardrobeItem.findMany({ where: { householdId: context.householdId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, category: true, createdAt: true } }),
    db.inventoryLog.findMany({ where: { householdId: context.householdId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, actionType: true, quantity: true, createdAt: true, product: { select: { name: true } } } }),
    db.product.findMany({ where: { householdId: context.householdId, isActive: 1, isGroupable: 0 }, select: { minStock: true, stockEntries: { where: { status: "ACTIVE", availableQuantity: { gt: 0 }, OR: [{ expiryDate: null }, { expiryDate: { gte: businessToday() } }] }, select: { availableQuantity: true } } } }),
  ]);
  let expenses = new Prisma.Decimal(0);
  let refunds = new Prisma.Decimal(0);
  const byModule = new Map<ExpenseModule, Prisma.Decimal>(modules.map((module) => [module, new Prisma.Decimal(0)]));
  for (const transaction of transactions) {
    if (transaction.type === "EXPENSE") expenses = expenses.add(transaction.amount);
    if (transaction.type === "REFUND") refunds = refunds.add(transaction.amount);
    const sign = transaction.type === "EXPENSE" ? 1 : transaction.type === "REFUND" ? -1 : 0;
    if (sign) for (const allocation of transaction.allocations) byModule.set(allocation.module, (byModule.get(allocation.module) ?? new Prisma.Decimal(0)).add(allocation.amount.mul(sign)));
  }
  const transactionEvents: DashboardEvent[] = transactions.slice(0, 8).map((item) => ({ id: `transaction:${item.id}`, kind: "TRANSACTION", title: item.merchant ?? (item.type === "REFUND" ? "退款" : "账本记录"), detail: `${item.type === "REFUND" ? "退款" : item.type === "INCOME" ? "收入" : "支出"} ¥${formatMoney(item.amount)}`, occurredAt: item.transactionAt.toISOString(), href: `/ledger/${item.id}` }));
  const events: DashboardEvent[] = [
    ...transactionEvents,
    ...care.map((item) => ({ id: `care:${item.id}`, kind: "CARE" as const, title: item.title, detail: item.provider ?? "儿童保健", occurredAt: item.occurredAt.toISOString(), href: "/care" })),
    ...wardrobe.map((item) => ({ id: `wardrobe:${item.id}`, kind: "WARDROBE" as const, title: item.name, detail: item.category ?? "衣柜记录", occurredAt: item.createdAt.toISOString(), href: `/wardrobe/${item.id}` })),
    ...inventory.map((item) => ({ id: `inventory:${item.id}`, kind: "INVENTORY" as const, title: item.product.name, detail: `${item.actionType} ${item.quantity}`, occurredAt: item.createdAt.toISOString(), href: "/consumables" })),
  ].toSorted((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 10);
  const stocks = products.map((product) => ({ minStock: product.minStock, current: product.stockEntries.reduce((sum, entry) => sum + entry.availableQuantity, 0) }));
  return { month, netExpense: formatMoney(expenses.sub(refunds)), transactionCount: transactions.length, byModule: modules.map((module) => ({ module, amount: formatMoney(byModule.get(module) ?? 0) })), lowStockCount: stocks.filter((item) => item.current > 0 && item.current <= item.minStock).length, outOfStockCount: stocks.filter((item) => item.current === 0).length, recentEvents: events };
}

export const dashboardService = { getDashboardOverview };
