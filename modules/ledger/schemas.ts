import { z } from "zod";

const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const occurredAt = z.iso.datetime({ offset: true });
const allocation = z.object({
  module: z.enum(["CHILD_CARE", "WARDROBE", "CONSUMABLES", "OTHER"]),
  categoryId: z.uuid().optional(),
  amount: money,
  note: z.string().max(1_000).optional(),
});

export const createTransactionSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  amount: money,
  occurredAt,
  paymentAccountId: z.uuid().optional(),
  merchant: z.string().max(1_000).optional(),
  payee: z.string().max(1_000).optional(),
  note: z.string().max(1_000).optional(),
  allocations: z.array(allocation).min(1).max(20),
});

export const updateTransactionSchema = createTransactionSchema.omit({ type: true }).extend({
  paymentAccountId: z.uuid().nullable().optional(),
  merchant: z.string().max(1_000).nullable().optional(),
  note: z.string().max(1_000).nullable().optional(),
});

export const createRefundSchema = z.object({
  originalTransactionId: z.uuid(),
  amount: money,
  occurredAt,
  note: z.string().max(1_000).optional(),
  allocations: z.array(allocation).min(1).max(20),
});

export const ledgerListSchema = z.object({
  cursor: z.string().max(1_000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  query: z.string().trim().max(200).optional(),
  type: z.enum(["EXPENSE", "INCOME", "REFUND"]).optional(),
  module: z.enum(["CHILD_CARE", "WARDROBE", "CONSUMABLES", "OTHER"]).optional(),
  from: occurredAt.optional(),
  to: occurredAt.optional(),
});
