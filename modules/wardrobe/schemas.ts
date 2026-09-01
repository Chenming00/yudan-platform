import { z } from "zod";

const uuid = z.uuid();
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional();

export const wardrobeItemInputSchema = z.object({
  babyProfileId: uuid.optional(),
  name: z.string().trim().min(1).max(200),
  category: optionalText(100),
  size: optionalText(100),
  season: optionalText(100),
  color: optionalText(100),
  quantity: z.number().int().min(1).max(100).optional(),
  note: optionalText(1_000),
});

export const giftedItemsSchema = z.object({ items: z.array(wardrobeItemInputSchema).min(1).max(100) });
export const wardrobePurchaseSchema = z.object({
  purchasedAt: z.iso.datetime({ offset: true }),
  merchant: optionalText(300),
  note: optionalText(1_000),
  transactionAllocationId: uuid,
  items: z.array(wardrobeItemInputSchema).min(1).max(100),
});
export const wardrobeStatusSchema = z.object({
  status: z.enum(["ACTIVE", "STORED", "DONATED", "SOLD", "DISCARDED"]),
  saleTransactionAllocationId: uuid.optional(),
}).superRefine((value, context) => {
  if (value.status === "SOLD" && !value.saleTransactionAllocationId) {
    context.addIssue({ code: "custom", path: ["saleTransactionAllocationId"], message: "出售衣物必须关联收入 Allocation。" });
  }
  if (value.status !== "SOLD" && value.saleTransactionAllocationId) {
    context.addIssue({ code: "custom", path: ["saleTransactionAllocationId"], message: "只有出售状态可以关联收入 Allocation。" });
  }
});
