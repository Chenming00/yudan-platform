"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createCompositeExpense, compositeExpenseSchema } from "@/application";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { AppError } from "@/lib/errors/app-error";

export type CompositeExpenseFormState = { status: "idle" | "error"; message?: string };

function occurredAtWithOffset(value: string) {
  if (/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return value;
  return `${value}${/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? ":00" : ""}+08:00`;
}

function allocationsFromForm(formData: FormData) {
  const count = Math.min(Number(formData.get("allocationCount") ?? 0), 20);
  return Array.from({ length: count }, (_, index) => {
    const moduleValue = formData.get(`allocations.${index}.module`)?.toString();
    const amount = formData.get(`allocations.${index}.amount`)?.toString();
    const base = { module: moduleValue, amount, categoryId: formData.get(`allocations.${index}.categoryId`)?.toString() || undefined, note: formData.get(`allocations.${index}.note`)?.toString() || undefined };
    if (moduleValue === "CHILD_CARE") return { ...base, care: { babyProfileId: formData.get(`allocations.${index}.care.babyProfileId`)?.toString(), type: formData.get(`allocations.${index}.care.type`)?.toString(), occurredAt: occurredAtWithOffset(formData.get("occurredAt")?.toString() ?? ""), title: formData.get(`allocations.${index}.care.title`)?.toString(), provider: formData.get(`allocations.${index}.care.provider`)?.toString() || undefined } };
    if (moduleValue === "WARDROBE") return { ...base, wardrobe: { items: [{ name: formData.get(`allocations.${index}.wardrobe.name`)?.toString(), category: formData.get(`allocations.${index}.wardrobe.category`)?.toString() || undefined, size: formData.get(`allocations.${index}.wardrobe.size`)?.toString() || undefined, quantity: Number(formData.get(`allocations.${index}.wardrobe.quantity`) ?? 1) }] } };
    if (moduleValue === "CONSUMABLES") return { ...base, consumables: { items: [{ productCode: formData.get(`allocations.${index}.consumables.productCode`)?.toString(), quantity: Number(formData.get(`allocations.${index}.consumables.quantity`) ?? 1), lineAmount: amount, expiresOn: formData.get(`allocations.${index}.consumables.expiresOn`)?.toString() || undefined, storageLocation: formData.get(`allocations.${index}.consumables.storageLocation`)?.toString() || undefined }] } };
    return base;
  });
}

export async function createCompositeExpenseAction(_state: CompositeExpenseFormState, formData: FormData): Promise<CompositeExpenseFormState> {
  const parsed = compositeExpenseSchema.safeParse({ idempotencyKey: formData.get("idempotencyKey"), amount: formData.get("amount"), occurredAt: occurredAtWithOffset(formData.get("occurredAt")?.toString() ?? ""), paymentAccountId: formData.get("paymentAccountId")?.toString() || undefined, merchant: formData.get("merchant")?.toString() || undefined, note: formData.get("note")?.toString() || undefined, allocations: allocationsFromForm(formData) });
  if (!parsed.success) return { status: "error", message: "请检查付款信息、用途金额和对应业务明细。" };
  let transactionId: string;
  try {
    const actor = await requirePlatformActor();
    const householdId = actor.householdIds[0];
    if (!householdId) throw new AppError("PERMISSION_DENIED", "尚未加入家庭空间。");
    transactionId = (await createCompositeExpense(createActionContext(actor.userId, householdId), parsed.data)).transactionId;
    revalidatePath("/");
    revalidatePath("/ledger");
    revalidatePath("/care");
    revalidatePath("/wardrobe");
    revalidatePath("/consumables");
  } catch (error) {
    return { status: "error", message: error instanceof AppError ? error.message : "组合记账失败，未保存任何数据。" };
  }
  redirect(`/ledger/${transactionId}`);
}
