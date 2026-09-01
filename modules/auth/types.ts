import type { ActionContext } from "@/lib/types/platform";
import type { permissions } from "@/lib/db/permission-catalog";

export type PermissionCode = (typeof permissions)[number][0];

export type AuthenticationMethod = "EMAIL_PASSWORD" | "GITHUB";

export interface RegisterWithInvitationInput {
  email: string;
  password: string;
  invitationCode: string;
}

export interface SignInWithPasswordInput {
  email: string;
  password: string;
}

export interface AuthenticationService {
  registerWithInvitation(input: RegisterWithInvitationInput): Promise<{ userId: string }>;
  signInWithPassword(input: SignInWithPasswordInput): Promise<{ userId: string }>;
}

export interface AuthorizationRequest {
  context: ActionContext;
  permission: PermissionCode;
  resourceId?: string;
}

export interface AuthorizationService {
  authorize(request: AuthorizationRequest): Promise<void>;
}
