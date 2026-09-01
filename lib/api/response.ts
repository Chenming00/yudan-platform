import type { ErrorCode } from "@/lib/errors/app-error";

export type ApiSuccess<T> = {
  success: true;
  data: T;
  requestId: string;
};

export type ApiFailure = {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  requestId: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function apiSuccess<T>(data: T, requestId: string): ApiSuccess<T> {
  return { success: true, data, requestId };
}

export function apiFailure(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: unknown,
): ApiFailure {
  return {
    success: false,
    error: { code, message, ...(details === undefined ? {} : { details }) },
    requestId,
  };
}

