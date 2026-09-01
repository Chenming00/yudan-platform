import "server-only";

import { createActionContext } from "@/lib/auth/authorization";
import { verifyApiCredential } from "@/lib/auth/api-credentials";
import { getPlatformActor } from "@/lib/auth/session";
import { AppError } from "@/lib/errors/app-error";

export async function getConsumablesApiContext(request: Request, permission: "consumables.read" | "consumables.write", requestId: string) {
  const authorization = request.headers.get("authorization");
  const credential = authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? request.headers.get("x-api-key");
  if (credential) {
    const verified = await verifyApiCredential(credential.trim(), permission);
    if (!verified.householdId) throw new AppError("PERMISSION_DENIED", "API 凭证未绑定家庭空间。");
    return createActionContext(verified.createdByUserId, verified.householdId, requestId);
  }
  const actor = await getPlatformActor();
  if (!actor) throw new AppError("AUTH_REQUIRED", "请先登录或提供 API 凭证。");
  const householdId = actor.householdIds[0];
  if (!householdId) throw new AppError("PERMISSION_DENIED", "尚未加入家庭空间。");
  return createActionContext(actor.userId, householdId, requestId);
}
