"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { AppError } from "@/lib/errors/app-error";
import { createCompositeRefund } from "@/application";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/modules/ledger";
import {
  createRefundSchema,
  createTransactionSchema,
  updateTransactionSchema,
} from "@/modules/ledger/schemas";

export type LedgerFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function occurredAtWithOffset(value: string) {
  if (/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return value;
  return `${value}${/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? ":00" : ""}+08:00`;
}

function allocationsFromForm(formData: FormData) {
  const count = Math.min(Number(formData.get("allocationCount") ?? 0), 20);
  return Array.from({ length: count }, (_, index) => ({
    module: formData.get(`allocations.${index}.module`)?.toString(),
    categoryId: formData.get(`allocations.${index}.categoryId`)?.toString() || undefined,
    amount: formData.get(`allocations.${index}.amount`)?.toString(),
    note: formData.get(`allocations.${index}.note`)?.toString() || undefined,
  }));
}

function formError(error: unknown): LedgerFormState {
  if (error instanceof AppError) return { status: "error", message: error.message };
  return { status: "error", message: "账目保存失败，请稍后重试。" };
}

async function contextForCurrentHousehold() {
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) throw new AppError("PERMISSION_DENIED", "尚未加入家庭空间。" );
  return createActionContext(actor.userId, householdId);
}

export async function createTransactionAction(
  _previousState: LedgerFormState,
  formData: FormData,
): Promise<LedgerFormState> {
  const parsed = createTransactionSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    occurredAt: occurredAtWithOffset(formData.get("occurredAt")?.toString() ?? ""),
    paymentAccountId: formData.get("paymentAccountId")?.toString() || undefined,
    merchant: formData.get("merchant")?.toString() || undefined,
    note: formData.get("note")?.toString() || undefined,
    allocations: allocationsFromForm(formData),
  });
  if (!parsed.success) return { status: "error", message: "请检查金额、时间和拆分明细。", fieldErrors: parsed.error.flatten().fieldErrors };
  let resultId: string;
  try {
    const result = await createTransaction(await contextForCurrentHousehold(), parsed.data);
    resultId = result.id;
    revalidatePath("/ledger");
  } catch (error) {
    return formError(error);
  }
  redirect(`/ledger/${resultId}`);
}

export async function updateTransactionAction(
  transactionId: string,
  _previousState: LedgerFormState,
  formData: FormData,
): Promise<LedgerFormState> {
  const parsed = updateTransactionSchema.safeParse({
    amount: formData.get("amount"),
    occurredAt: occurredAtWithOffset(formData.get("occurredAt")?.toString() ?? ""),
    paymentAccountId: formData.get("paymentAccountId")?.toString() || null,
    merchant: formData.get("merchant")?.toString() || null,
    note: formData.get("note")?.toString() || null,
    allocations: allocationsFromForm(formData),
  });
  if (!parsed.success) return { status: "error", message: "请检查金额、时间和拆分明细。", fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await updateTransaction(await contextForCurrentHousehold(), transactionId, parsed.data);
    revalidatePath("/ledger");
  } catch (error) {
    return formError(error);
  }
  redirect(`/ledger/${transactionId}`);
}

export async function createRefundAction(
  originalTransactionId: string,
  _previousState: LedgerFormState,
  formData: FormData,
): Promise<LedgerFormState> {
  const parsed = createRefundSchema.safeParse({
    originalTransactionId,
    amount: formData.get("amount"),
    occurredAt: occurredAtWithOffset(formData.get("occurredAt")?.toString() ?? ""),
    note: formData.get("note")?.toString() || undefined,
    allocations: allocationsFromForm(formData),
  });
  if (!parsed.success) return { status: "error", message: "请检查退款金额和拆分明细。", fieldErrors: parsed.error.flatten().fieldErrors };
  let refundId: string;
  try {
    const refund = await createCompositeRefund(await contextForCurrentHousehold(), { ...parsed.data, idempotencyKey: formData.get("idempotencyKey")?.toString() || crypto.randomUUID() });
    refundId = refund.transactionId;
    revalidatePath("/ledger");
  } catch (error) {
    return formError(error);
  }
  redirect(`/ledger/${refundId}`);
}

export async function deleteTransactionAction(formData: FormData) {
  const id = formData.get("transactionId")?.toString();
  if (!id) return;
  await deleteTransaction(await contextForCurrentHousehold(), id);
  revalidatePath("/ledger");
  redirect("/ledger");
}
