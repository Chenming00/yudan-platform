import "server-only";

import { NextResponse } from "next/server";
import type { ZodError } from "zod";

import { apiFailure } from "@/lib/api/response";
import { createActionContext } from "@/lib/auth/authorization";
import { AuthError } from "@/lib/auth/errors";
import { getPlatformActor } from "@/lib/auth/session";
import { AppError, type ErrorCode } from "@/lib/errors/app-error";

export function requestIdFrom(request: Request) {
  return request.headers.get("x-request-id")?.slice(0, 128) || crypto.randomUUID();
}
export async function getLedgerApiContext(requestId: string) {
  const actor = await getPlatformActor();
  if (!actor) throw new AppError("AUTH_REQUIRED", "请先登录。" );
  const householdId = actor.householdIds[0];
  if (!householdId) throw new AppError("PERMISSION_DENIED", "尚未加入家庭空间。" );
  return createActionContext(actor.userId, householdId, requestId);
}

function statusFor(code: ErrorCode) {
  if (code === "AUTH_REQUIRED") return 401;
  if (code === "PERMISSION_DENIED") return 403;
  if (code === "RESOURCE_NOT_FOUND") return 404;
  if (code === "CONFLICT" || code === "IDEMPOTENCY_CONFLICT") return 409;
  if (code === "VALIDATION_FAILED" || code === "INVITATION_INVALID" || code === "REGISTRATION_INVITE_REQUIRED") return 400;
  return 500;
}

export function ledgerApiError(error: unknown, requestId: string) {
  if (error instanceof AppError) {
    return NextResponse.json(apiFailure(error.code, error.message, requestId, error.details), { status: statusFor(error.code) });
  }
  if (error instanceof AuthError) {
    const code: ErrorCode = error.code === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : error.code === "PERMISSION_DENIED" ? "PERMISSION_DENIED" : "AUTH_REQUIRED";
    return NextResponse.json(apiFailure(code, error.message, requestId), { status: statusFor(code) });
  }
  return NextResponse.json(apiFailure("INTERNAL_ERROR", "服务暂时不可用。", requestId), { status: 500 });
}

export function validationFailure(error: ZodError, requestId: string) {
  return NextResponse.json(apiFailure("VALIDATION_FAILED", "请求参数不正确。", requestId, error.flatten()), { status: 400 });
}
