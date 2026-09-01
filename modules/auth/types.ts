import type { ActionContext } from "@/lib/types/platform";

export type PermissionCode =
  | "ledger.read"
  | "ledger.write"
  | "care.read"
  | "care.write"
  | "wardrobe.read"
  | "wardrobe.write"
  | "consumables.read"
  | "consumables.write"
  | "members.manage"
  | "invitations.manage";

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
