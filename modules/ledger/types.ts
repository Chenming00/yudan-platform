import type {
  ActionContext,
  CursorPage,
  IsoDateTime,
  MoneyString,
} from "@/lib/types/platform";

export type TransactionType = "EXPENSE" | "INCOME" | "REFUND";
export type ExpenseModule =
  | "CHILD_CARE"
  | "WARDROBE"
  | "CONSUMABLES"
  | "OTHER";

export interface TransactionAllocationInput {
  module: ExpenseModule;
  category: string;
  amount: MoneyString;
  sourceType?: string;
  sourceId?: string;
  note?: string;
}

export interface CreateTransactionInput {
  type: TransactionType;
  amount: MoneyString;
  occurredAt: IsoDateTime;
  payee?: string;
  note?: string;
  allocations: TransactionAllocationInput[];
}

export interface LedgerTransaction {
  id: string;
  type: TransactionType;
  amount: MoneyString;
  occurredAt: IsoDateTime;
  allocations: TransactionAllocationInput[];
}

export interface LedgerService {
  createTransaction(
    context: ActionContext,
    input: CreateTransactionInput,
  ): Promise<LedgerTransaction>;
  getTransaction(
    context: ActionContext,
    id: string,
  ): Promise<LedgerTransaction | null>;
  listTransactions(
    context: ActionContext,
    cursor?: string,
  ): Promise<CursorPage<LedgerTransaction>>;
}

