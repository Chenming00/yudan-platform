"use server";

import { revalidatePath } from "next/cache";

import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { AppError } from "@/lib/errors/app-error";
import { createGiftedItems, createPurchase } from "@/modules/wardrobe";
import { giftedItemsSchema, wardrobePurchaseSchema } from "@/modules/wardrobe/schemas";

export type WardrobeFormState = { status: "idle" | "success" | "error"; message?: string };

function withShanghaiOffset(value: string) {
  if (/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return value;
  return `${value}${/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? ":00" : ""}+08:00`;
}

async function currentContext() {
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) throw new AppError("PERMISSION_DENIED", "尚未加入家庭空间。");
  return createActionContext(actor.userId, householdId);
}

export async function createWardrobeEntryAction(_state: WardrobeFormState, formData: FormData): Promise<WardrobeFormState> {
  const source = formData.get("source")?.toString();
  const babyProfileId = formData.get("babyProfileId")?.toString();
  const item = {
    babyProfileId: babyProfileId && babyProfileId !== "NONE" ? babyProfileId : undefined,
    name: formData.get("name")?.toString(),
    category: formData.get("category")?.toString() || undefined,
    size: formData.get("size")?.toString() || undefined,
    season: formData.get("season")?.toString() || undefined,
    color: formData.get("color")?.toString() || undefined,
    quantity: Number(formData.get("quantity") ?? 1),
    note: formData.get("note")?.toString() || undefined,
  };
  try {
    const context = await currentContext();
    if (source === "PURCHASED") {
      const parsed = wardrobePurchaseSchema.safeParse({
        purchasedAt: withShanghaiOffset(formData.get("purchasedAt")?.toString() ?? ""),
        merchant: formData.get("merchant")?.toString() || undefined,
        transactionAllocationId: formData.get("transactionAllocationId")?.toString(),
        items: [item],
      });
      if (!parsed.success) return { status: "error", message: "请检查购买时间、账本 Allocation 和衣物信息。" };
      await createPurchase(context, parsed.data);
    } else {
      const parsed = giftedItemsSchema.safeParse({ items: [item] });
      if (!parsed.success) return { status: "error", message: "请检查衣物名称、数量和宝宝资料。" };
      await createGiftedItems(context, parsed.data);
    }
    revalidatePath("/wardrobe");
    return { status: "success", message: source === "PURCHASED" ? "购买记录和衣物已保存。" : "赠送衣物已保存，不会产生账本支出。" };
  } catch (error) {
    return { status: "error", message: error instanceof AppError ? error.message : "衣物保存失败，请稍后重试。" };
  }
}
