import type { ActionContext, CursorPage, IsoDateTime, MoneyString } from "@/lib/types/platform";

export type TransactionType = "EXPENSE" | "INCOME" | "REFUND";
export type ExpenseModule = "CHILD_CARE" | "WARDROBE" | "CONSUMABLES" | "OTHER";

export interface TransactionAllocationInput {
  module: ExpenseModule;
  categoryId?: string;
  amount: MoneyString;
  note?: string;
}

export interface CreateTransactionInput {
  type: Exclude<TransactionType, "REFUND">;
  amount: MoneyString;
  occurredAt: IsoDateTime;
  paymentAccountId?: string;
  merchant?: string;
  payee?: string;
  note?: string;
  allocations: TransactionAllocationInput[];
}

export interface UpdateTransactionInput {
  amount: MoneyString;
  occurredAt: IsoDateTime;
  paymentAccountId?: string | null;
  merchant?: string | null;
  note?: string | null;
  allocations: TransactionAllocationInput[];
}

export interface CreateRefundInput {
  originalTransactionId: string;
  amount: MoneyString;
  occurredAt: IsoDateTime;
  note?: string;
  allocations: TransactionAllocationInput[];
}

export interface LedgerAllocation {
  id: string;
  module: ExpenseModule;
  category: { id: string; code: string; name: string } | null;
  amount: MoneyString;
  note: string | null;
}

export interface LedgerTransaction {
  id: string;
  type: TransactionType;
  amount: MoneyString;
  currency: string;
  occurredAt: IsoDateTime;
  paymentAccount: { id: string; name: string } | null;
  merchant: string | null;
  note: string | null;
  refundOfTransactionId: string | null;
  allocations: LedgerAllocation[];
}

export interface LedgerListFilters {
  cursor?: string;
  limit?: number;
  query?: string;
  type?: TransactionType;
  module?: ExpenseModule;
  from?: IsoDateTime;
  to?: IsoDateTime;
}

export interface LedgerSummary {
  month: string;
  income: MoneyString;
  expense: MoneyString;
  refunds: MoneyString;
  netExpense: MoneyString;
  balance: MoneyString;
  transactionCount: number;
  byModule: Array<{ module: ExpenseModule; amount: MoneyString }>;
  byCategory: Array<{ categoryId: string | null; name: string; amount: MoneyString }>;
  byDay: Array<{ date: string; income: MoneyString; expense: MoneyString; refunds: MoneyString }>;
}

export interface LedgerOptions {
  categories: Array<{ id: string; code: string; name: string; module: ExpenseModule }>;
  paymentAccounts: Array<{ id: string; name: string; type: string }>;
}

export interface LedgerService {
  createTransaction(context: ActionContext, input: CreateTransactionInput): Promise<LedgerTransaction>;
  updateTransaction(context: ActionContext, id: string, input: UpdateTransactionInput): Promise<LedgerTransaction>;
  createRefund(context: ActionContext, input: CreateRefundInput): Promise<LedgerTransaction>;
  deleteTransaction(context: ActionContext, id: string): Promise<void>;
  getTransaction(context: ActionContext, id: string): Promise<LedgerTransaction | null>;
  listTransactions(context: ActionContext, filters?: LedgerListFilters): Promise<CursorPage<LedgerTransaction>>;
  getLedgerSummary(context: ActionContext, month: string): Promise<LedgerSummary>;
  getLedgerOptions(context: ActionContext): Promise<LedgerOptions>;
}
