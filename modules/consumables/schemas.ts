import { z } from "zod";

const uuid = z.uuid();
const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,4})?$/);
const optionalText = (max = 1_000) => z.string().trim().max(max).optional();
export const productSchema = z.object({ name: z.string().trim().min(1).max(200), category: z.string().trim().min(1).max(100), unit: z.string().trim().min(1).max(50), spec: optionalText(200), barcode: optionalText(100), minStock: z.number().int().min(0).max(99_999).optional(), isFavorite: z.boolean().optional(), skipReplenishment: z.boolean().optional(), note: optionalText() });
export const receiveStockSchema = z.object({ productCode: z.string().trim().min(1).max(100), quantity: z.number().int().min(1).max(99_999), source: z.enum(["GIFT", "TRANSFER", "ADJUSTMENT", "HISTORICAL"]), expiresOn: z.iso.date().optional(), storageLocation: optionalText(200), sourceLabel: optionalText(200), totalCost: money.optional(), note: optionalText() });
export const consumeStockSchema = z.object({ productCode: z.string().trim().min(1).max(100), quantity: z.number().int().min(1).max(99_999) });
export const countStockSchema = z.object({ productCode: z.string().trim().min(1).max(100), targetQuantity: z.number().int().min(0).max(99_999), reason: optionalText(500) });
export const undoSchema = z.object({ logId: z.number().int().positive() });
export const adjustStockEntrySchema = z.object({ type: z.enum(["add", "remove", "set"]), quantity: z.number().int().min(1).max(99_999), reason: optionalText(500), note: optionalText() });
export const purchaseItemSchema = z.object({ productCode: z.string().trim().min(1).max(100), description: optionalText(300), quantity: z.number().int().min(1).max(99_999), unitPrice: money.optional(), lineAmount: money, expiresOn: z.iso.date().optional(), storageLocation: optionalText(200) });
export const consumablePurchaseSchema = z.object({ transactionAllocationId: uuid, purchasedAt: z.iso.datetime({ offset: true }), merchant: optionalText(300), note: optionalText(), items: z.array(purchaseItemSchema).min(1).max(100) });
export const productGroupSchema = z.object({ name: z.string().trim().min(1).max(200), description: optionalText(), sortOrder: z.number().int().optional() });
export const productGroupItemSchema = z.object({ productCode: z.string().trim().min(1).max(100), suggestedQuantity: z.number().int().min(1).max(99_999).optional(), note: optionalText(), sortOrder: z.number().int().optional() });
