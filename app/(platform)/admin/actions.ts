"use server";

import { revalidatePath } from "next/cache";

import { createActionContext } from "@/lib/auth/authorization";
import { publicAuthMessage } from "@/lib/auth/errors";
import { requirePlatformActor } from "@/lib/auth/session";
import { invitationSchema, memberUpdateSchema } from "@/lib/auth/validation";
import {
  createInvitation,
  revokeInvitation,
  setPlatformUserStatus,
  updateHouseholdMember,
} from "@/modules/auth";

export type AdminFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  invitationCode?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createInvitationAction(
  _previousState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const parsed = invitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "请检查邀请设置。",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const actor = await requirePlatformActor();
    const context = createActionContext(actor.userId, parsed.data.householdId);
    const invitation = await createInvitation(context, {
      roleCode: parsed.data.roleCode,
      email: parsed.data.email || undefined,
      expiresInDays: parsed.data.expiresInDays,
    });
    revalidatePath("/admin/invitations");
    return {
      status: "success",
      message: "邀请码已创建，请立即安全发送给受邀人。",
      invitationCode: invitation.invitationCode,
    };
  } catch (error) {
    return { status: "error", message: publicAuthMessage(error) };
  }
}

export async function revokeInvitationAction(formData: FormData) {
  const householdId = formData.get("householdId")?.toString();
  const invitationId = formData.get("invitationId")?.toString();
  if (!householdId || !invitationId) return;

  const actor = await requirePlatformActor();
  const context = createActionContext(actor.userId, householdId);
  await revokeInvitation(context, invitationId);
  revalidatePath("/admin/invitations");
}

export async function updateHouseholdMemberAction(formData: FormData) {
  const parsed = memberUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const actor = await requirePlatformActor();
  const context = createActionContext(actor.userId, parsed.data.householdId);
  await updateHouseholdMember(context, {
    userId: parsed.data.userId,
    roleCode: parsed.data.roleCode,
    status: parsed.data.status,
  });
  revalidatePath("/admin/users");
}

export async function setPlatformUserStatusAction(formData: FormData) {
  const householdId = formData.get("householdId")?.toString();
  const userId = formData.get("userId")?.toString();
  const status = formData.get("status")?.toString();
  if (
    !householdId ||
    !userId ||
    !["ACTIVE", "SUSPENDED", "DISABLED"].includes(status ?? "")
  ) return;

  const actor = await requirePlatformActor();
  const context = createActionContext(actor.userId, householdId);
  await setPlatformUserStatus(
    context,
    userId,
    status as "ACTIVE" | "SUSPENDED" | "DISABLED",
  );
  revalidatePath("/admin/users");
}
