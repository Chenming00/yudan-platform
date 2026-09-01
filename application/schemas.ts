import { z } from "zod";

import { careRecordSchema } from "@/modules/care/schemas";
import { purchaseItemSchema } from "@/modules/consumables/schemas";
import { wardrobeItemInputSchema } from "@/modules/wardrobe/schemas";

const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional();
const idempotencyKey = z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/);

const allocationBase = z.object({
  module: z.enum(["CHILD_CARE", "WARDROBE", "CONSUMABLES", "OTHER"]),
  categoryId: z.uuid().optional(),
  amount: money,
  note: optionalText(1_000),
  care: careRecordSchema.omit({ transactionAllocationId: true }).optional(),
  wardrobe: z.object({ items: z.array(wardrobeItemInputSchema).min(1).max(100) }).optional(),
  consumables: z.object({ items: z.array(purchaseItemSchema).min(1).max(100) }).optional(),
}).superRefine((value, context) => {
  const expected = value.module === "CHILD_CARE" ? "care" : value.module === "WARDROBE" ? "wardrobe" : value.module === "CONSUMABLES" ? "consumables" : null;
  for (const field of ["care", "wardrobe", "consumables"] as const) {
    if (field === expected && !value[field]) context.addIssue({ code: "custom", path: [field], message: "该用途需要对应业务明细。" });
    if (field !== expected && value[field]) context.addIssue({ code: "custom", path: [field], message: "业务明细与用途模块不匹配。" });
  }
});

export const compositeExpenseSchema = z.object({
  idempotencyKey,
  amount: money,
  occurredAt: z.iso.datetime({ offset: true }),
  paymentAccountId: z.uuid().optional(),
  merchant: optionalText(1_000),
  note: optionalText(1_000),
  allocations: z.array(allocationBase).min(1).max(20),
});

export const compositeRefundSchema = z.object({
  idempotencyKey,
  originalTransactionId: z.uuid(),
  amount: money,
  occurredAt: z.iso.datetime({ offset: true }),
  note: optionalText(1_000),
  allocations: z.array(z.object({ module: z.enum(["CHILD_CARE", "WARDROBE", "CONSUMABLES", "OTHER"]), categoryId: z.uuid().optional(), amount: money, note: optionalText(1_000) })).min(1).max(20),
});
