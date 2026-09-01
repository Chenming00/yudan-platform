import "server-only";

import type { ActionContext } from "@/lib/types/platform";
import { AuthError } from "@/lib/auth/errors";
import {
  getCachedPermissions,
  setCachedPermissions,
} from "@/lib/auth/permission-cache";
import { getDatabase } from "@/lib/db/client";
import type { AuthorizationRequest, PermissionCode } from "@/modules/auth/types";

async function loadPermissions(userId: string, householdId?: string) {
  const cached = getCachedPermissions(userId, householdId);
  if (cached) return cached;

  const db = getDatabase();
  const [globalRoles, membership] = await Promise.all([
    db.userGlobalRole.findMany({
      where: { userId },
      select: {
        role: {
          select: {
            permissions: { select: { permission: { select: { code: true } } } },
          },
        },
      },
    }),
    householdId
      ? db.householdMember.findUnique({
          where: { householdId_userId: { householdId, userId } },
          select: {
            status: true,
            role: {
              select: {
                permissions: { select: { permission: { select: { code: true } } } },
              },
            },
          },
        })
      : null,
  ]);

  const permissionCodes = new Set<PermissionCode>();
  for (const assignment of globalRoles) {
    for (const item of assignment.role.permissions) {
      permissionCodes.add(item.permission.code as PermissionCode);
    }
  }
  if (membership?.status === "ACTIVE") {
    for (const item of membership.role.permissions) {
      permissionCodes.add(item.permission.code as PermissionCode);
    }
  }

  return setCachedPermissions(userId, householdId, permissionCodes);
}

export async function authorize(request: AuthorizationRequest) {
  const db = getDatabase();
  const user = await db.appUser.findUnique({
    where: { id: request.context.userId },
    select: { status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new AuthError("ACCOUNT_INACTIVE", "账号不可用。" );
  }

  const permissionCodes = await loadPermissions(
    request.context.userId,
    request.context.householdId,
  );
  if (!permissionCodes.has(request.permission)) {
    throw new AuthError("PERMISSION_DENIED", "没有权限执行此操作。" );
  }
}

export function createActionContext(
  userId: string,
  householdId: string,
  requestId = crypto.randomUUID(),
): ActionContext {
  return { userId, householdId, requestId };
}
