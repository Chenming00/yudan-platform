import type { ExpenseModule, TransactionType } from "@/modules/ledger/types";

export const moduleLabels: Record<ExpenseModule, string> = {
  CHILD_CARE: "儿童保健",
  WARDROBE: "衣柜",
  CONSUMABLES: "消耗品",
  OTHER: "其他",
};

export const transactionTypeLabels: Record<TransactionType, string> = {
  EXPENSE: "支出",
  INCOME: "收入",
  REFUND: "退款",
};

export function formatCurrency(amount: string, currency = "CNY") {
  const negative = amount.startsWith("-");
  const [integer = "0", fraction = ""] = amount.replace("-", "").split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = currency === "CNY" ? "¥" : `${currency} `;
  return `${negative ? "−" : ""}${symbol}${grouped}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}
