import type { ActionContext, IsoDate } from "@/lib/types/platform";

export type WardrobeItemStatus =
  | "PLANNED"
  | "UNWORN"
  | "ACTIVE"
  | "OUTGROWN"
  | "STORED"
  | "DONATED"
  | "DISCARDED"
  | "SOLD";

export interface CreateWardrobeItemInput {
  name: string;
  category: string;
  size?: string;
  season?: string;
  purchasedOn?: IsoDate;
  purchaseAllocationId?: string;
  status: WardrobeItemStatus;
}

export interface WardrobeService {
  createItem(context: ActionContext, input: CreateWardrobeItemInput): Promise<{ id: string }>;
}

