"use server";

import { revalidatePath } from "next/cache";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { AppError } from "@/lib/errors/app-error";
import { consumeStock, countStock, createProduct, createPurchase, receiveStock } from "@/modules/consumables";
import { consumablePurchaseSchema, consumeStockSchema, countStockSchema, productSchema, receiveStockSchema } from "@/modules/consumables/schemas";

export type ConsumablesFormState = { status: "idle" | "success" | "error"; message?: string; logId?: number };
const offset = (value: string) => /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}${/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? ":00" : ""}+08:00`;
async function context() { const actor = await requirePlatformActor(); const householdId = actor.householdIds[0]; if (!householdId) throw new AppError("PERMISSION_DENIED", "尚未加入家庭空间。"); return createActionContext(actor.userId, householdId); }
const failure = (error: unknown): ConsumablesFormState => ({ status: "error", message: error instanceof AppError ? error.message : "操作失败，请稍后重试。" });

export async function inventoryOperationAction(_state: ConsumablesFormState, formData: FormData): Promise<ConsumablesFormState> {
  const operation = formData.get("operation")?.toString();
  const productCode = formData.get("productCode")?.toString();
  const amount = Number(formData.get("quantity"));
  try {
    let result;
    if (operation === "CONSUME") {
      const parsed = consumeStockSchema.safeParse({ productCode, quantity: amount }); if (!parsed.success) return { status: "error", message: "请选择产品并填写正确的出库数量。" };
      result = await consumeStock(await context(), parsed.data);
    } else if (operation === "COUNT") {
      const parsed = countStockSchema.safeParse({ productCode, targetQuantity: amount, reason: formData.get("reason")?.toString() || undefined }); if (!parsed.success) return { status: "error", message: "请选择产品并填写正确的盘点数量。" };
      result = await countStock(await context(), parsed.data);
    } else if (operation === "PURCHASE") {
      const parsed = consumablePurchaseSchema.safeParse({ transactionAllocationId: formData.get("transactionAllocationId"), purchasedAt: offset(formData.get("purchasedAt")?.toString() ?? ""), merchant: formData.get("merchant")?.toString() || undefined, items: [{ productCode, quantity: amount, lineAmount: formData.get("lineAmount")?.toString(), expiresOn: formData.get("expiresOn")?.toString() || undefined, storageLocation: formData.get("storageLocation")?.toString() || undefined }] });
      if (!parsed.success) return { status: "error", message: "请检查采购时间、数量、金额和账本 Allocation。" };
      await createPurchase(await context(), parsed.data); result = { currentStock: 0 };
    } else {
      const parsed = receiveStockSchema.safeParse({ productCode, quantity: amount, source: formData.get("source"), expiresOn: formData.get("expiresOn")?.toString() || undefined, storageLocation: formData.get("storageLocation")?.toString() || undefined, sourceLabel: formData.get("sourceLabel")?.toString() || undefined, note: formData.get("reason")?.toString() || undefined });
      if (!parsed.success) return { status: "error", message: "请选择产品、入库来源并填写正确数量。" };
      result = await receiveStock(await context(), parsed.data);
    }
    revalidatePath("/consumables");
    return { status: "success", message: operation === "PURCHASE" ? "采购和库存已保存。" : `操作成功，当前库存 ${result.currentStock}。`, logId: "logId" in result ? result.logId : undefined };
  } catch (error) { return failure(error); }
}

export async function createProductAction(_state: ConsumablesFormState, formData: FormData): Promise<ConsumablesFormState> {
  const parsed = productSchema.safeParse({ name: formData.get("name"), category: formData.get("category"), unit: formData.get("unit"), spec: formData.get("spec")?.toString() || undefined, barcode: formData.get("barcode")?.toString() || undefined, minStock: Number(formData.get("minStock") ?? 2) });
  if (!parsed.success) return { status: "error", message: "产品名称、分类、单位和安全库存必填且格式正确。" };
  try { await createProduct(await context(), parsed.data); revalidatePath("/consumables"); return { status: "success", message: "产品已创建。" }; } catch (error) { return failure(error); }
}
