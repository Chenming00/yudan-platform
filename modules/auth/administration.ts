import "server-only";

import type { ActionContext } from "@/lib/types/platform";
import { writeAuditLog } from "@/lib/auth/audit";
import { authorize } from "@/lib/auth/authorization";
import { AuthError } from "@/lib/auth/errors";
import { invalidatePermissionCache } from "@/lib/auth/permission-cache";
import { getDatabase } from "@/lib/db/client";

export async function listHouseholdMembers(context: ActionContext) {
  await authorize({ context, permission: "members.manage" });
  const db = getDatabase();
  return db.householdMember.findMany({
    where: { householdId: context.householdId },
    orderBy: { joinedAt: "asc" },
    select: {
      userId: true,
      status: true,
      joinedAt: true,
      role: { select: { code: true, name: true } },
      user: {
        select: { displayName: true, emailNormalized: true, status: true },
      },
    },
  });
}

export async function updateHouseholdMember(
  context: ActionContext,
  input: {
    userId: string;
    roleCode: "OWNER" | "EDITOR" | "VIEWER";
    status: "ACTIVE" | "SUSPENDED" | "LEFT";
  },
) {
  await authorize({ context, permission: "members.manage" });
  const db = getDatabase();

  await db.$transaction(async (tx) => {
    const [existing, role] = await Promise.all([
      tx.householdMember.findUnique({
        where: {
          householdId_userId: {
            householdId: context.householdId,
            userId: input.userId,
          },
        },
        select: { role: { select: { code: true } }, status: true },
      }),
      tx.role.findFirst({
        where: { code: input.roleCode, scope: "HOUSEHOLD" },
        select: { id: true },
      }),
    ]);

    if (!existing || !role) {
      throw new AuthError("VALIDATION_FAILED", "成员或家庭角色不存在。" );
    }

    const activeOwnerCount = await tx.householdMember.count({
      where: {
        householdId: context.householdId,
        status: "ACTIVE",
        role: { code: "OWNER" },
      },
    });
    if (
      existing.role.code === "OWNER" &&
      existing.status === "ACTIVE" &&
      (input.roleCode !== "OWNER" || input.status !== "ACTIVE") &&
      activeOwnerCount <= 1
    ) {
      throw new AuthError("VALIDATION_FAILED", "家庭至少需要保留一名有效所有者。" );
    }

    await tx.householdMember.update({
      where: {
        householdId_userId: {
          householdId: context.householdId,
          userId: input.userId,
        },
      },
      data: { roleId: role.id, status: input.status },
    });
    await writeAuditLog(tx, {
      action: "auth.member.updated",
      entityType: "HouseholdMember",
      entityId: `${context.householdId}:${input.userId}`,
      actorUserId: context.userId,
      householdId: context.householdId,
      requestId: context.requestId,
      beforeData: { roleCode: existing.role.code, status: existing.status },
      afterData: { roleCode: input.roleCode, status: input.status },
    });
  });

  invalidatePermissionCache(input.userId);
}

export async function setPlatformUserStatus(
  context: ActionContext,
  userId: string,
  status: "ACTIVE" | "SUSPENDED" | "DISABLED",
) {
  await authorize({ context, permission: "platform.admin" });
  if (userId === context.userId && status !== "ACTIVE") {
    throw new AuthError("VALIDATION_FAILED", "不能停用当前登录的超级管理员。" );
  }

  const db = getDatabase();
  await db.$transaction(async (tx) => {
    const current = await tx.appUser.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true },
    });
    await tx.appUser.update({ where: { id: userId }, data: { status } });
    await writeAuditLog(tx, {
      action: "auth.user.status_changed",
      entityType: "AppUser",
      entityId: userId,
      actorUserId: context.userId,
      householdId: context.householdId,
      requestId: context.requestId,
      beforeData: { status: current.status },
      afterData: { status },
    });
  });
  invalidatePermissionCache(userId);
}
