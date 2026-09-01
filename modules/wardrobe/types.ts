import type { ActionContext, IsoDateTime, MoneyString } from "@/lib/types/platform";

export type WardrobeItemStatus = "ACTIVE" | "STORED" | "DONATED" | "SOLD" | "DISCARDED";
export type WardrobeAcquisition = "PURCHASED" | "GIFTED";

export interface WardrobeItemInput {
  babyProfileId?: string;
  name: string;
  category?: string;
  size?: string;
  season?: string;
  color?: string;
  quantity?: number;
  note?: string;
}

export interface CreateWardrobePurchaseInput {
  purchasedAt: string;
  merchant?: string;
  note?: string;
  transactionAllocationId: string;
  items: WardrobeItemInput[];
}

export interface CreateGiftedWardrobeItemsInput { items: WardrobeItemInput[]; }
export interface UpdateWardrobeItemStatusInput { status: WardrobeItemStatus; saleTransactionAllocationId?: string; }

export interface WardrobeItemView {
  id: string;
  babyProfileId: string | null;
  babyName: string | null;
  name: string;
  category: string | null;
  size: string | null;
  season: string | null;
  color: string | null;
  quantity: number;
  status: WardrobeItemStatus;
  note: string | null;
  acquisition: WardrobeAcquisition;
  wardrobePurchaseId: string | null;
  purchaseAmount: MoneyString | null;
  saleTransactionAllocationId: string | null;
  createdAt: IsoDateTime;
}

export interface WardrobePurchaseView {
  id: string;
  purchasedAt: IsoDateTime;
  merchant: string | null;
  note: string | null;
  transactionAllocationId: string;
  amount: MoneyString;
  itemCount: number;
}

export interface WardrobeService {
  listItems(context: ActionContext): Promise<WardrobeItemView[]>;
  getItem(context: ActionContext, itemId: string): Promise<WardrobeItemView>;
  listPurchases(context: ActionContext): Promise<WardrobePurchaseView[]>;
  createPurchase(context: ActionContext, input: CreateWardrobePurchaseInput): Promise<WardrobePurchaseView>;
  createGiftedItems(context: ActionContext, input: CreateGiftedWardrobeItemsInput): Promise<WardrobeItemView[]>;
  updateItemStatus(context: ActionContext, itemId: string, input: UpdateWardrobeItemStatusInput): Promise<WardrobeItemView>;
}
