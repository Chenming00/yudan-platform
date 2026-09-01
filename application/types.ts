import type { CreateCareRecordInput } from "@/modules/care/types";
import type { ConsumablePurchaseItemInput } from "@/modules/consumables/types";
import type { ExpenseModule, TransactionAllocationInput } from "@/modules/ledger/types";
import type { WardrobeItemInput } from "@/modules/wardrobe/types";

export interface CompositeExpenseAllocationInput extends TransactionAllocationInput {
  care?: Omit<CreateCareRecordInput, "transactionAllocationId">;
  wardrobe?: { items: WardrobeItemInput[] };
  consumables?: { items: ConsumablePurchaseItemInput[] };
}

export interface CreateCompositeExpenseInput {
  idempotencyKey: string;
  amount: string;
  occurredAt: string;
  paymentAccountId?: string;
  merchant?: string;
  note?: string;
  allocations: CompositeExpenseAllocationInput[];
}

export interface CompositeExpenseResult {
  transactionId: string;
  amount: string;
  allocationIds: string[];
  businessRecordIds: Array<{ module: Exclude<ExpenseModule, "OTHER">; allocationId: string; recordId: string }>;
  replayed: boolean;
}

export interface CreateCompositeRefundInput {
  idempotencyKey: string;
  originalTransactionId: string;
  amount: string;
  occurredAt: string;
  note?: string;
  allocations: TransactionAllocationInput[];
}

export interface CompositeRefundResult {
  transactionId: string;
  originalTransactionId: string;
  amount: string;
  allocationIds: string[];
  replayed: boolean;
}
