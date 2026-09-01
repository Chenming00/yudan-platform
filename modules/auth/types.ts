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

export interface AuthorizationRequest {
  context: ActionContext;
  permission: PermissionCode;
  resourceId?: string;
}

export interface AuthorizationService {
  authorize(request: AuthorizationRequest): Promise<void>;
}

