export type AuthErrorCode =
  | "AUTH_REQUIRED"
  | "EMAIL_NOT_VERIFIED"
  | "ACCOUNT_INACTIVE"
  | "REGISTRATION_INVITE_REQUIRED"
  | "INVITATION_INVALID"
  | "PERMISSION_DENIED"
  | "RATE_LIMITED"
  | "VALIDATION_FAILED"
  | "INTERNAL_ERROR";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function publicAuthMessage(error: unknown) {
  if (error instanceof AuthError) return error.message;
  return "操作没有完成，请稍后重试。";
}
