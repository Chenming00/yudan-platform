import type { ActionContext, IsoDate, IsoDateTime, MoneyString } from "@/lib/types/platform";

export type StockEntrySource = "GIFT" | "TRANSFER" | "ADJUSTMENT" | "HISTORICAL";
export type ProductStockStatus = "OK" | "LOW" | "OUT";

export interface ProductView {
  productCode: string;
  name: string;
  category: string;
  unit: string;
  spec: string | null;
  barcode: string | null;
  minStock: number;
  isFavorite: boolean;
  skipReplenishment: boolean;
  isActive: boolean;
  note: string | null;
  currentStock: number;
  stockStatus: ProductStockStatus;
  nearestExpiryDays: number | null;
  expiredQuantity: number;
}

export interface CreateProductInput {
  name: string;
  category: string;
  unit: string;
  spec?: string;
  barcode?: string;
  minStock?: number;
  isFavorite?: boolean;
  skipReplenishment?: boolean;
  note?: string;
}

export interface ReceiveStockInput {
  productCode: string;
  quantity: number;
  source: StockEntrySource;
  expiresOn?: string;
  storageLocation?: string;
  sourceLabel?: string;
  totalCost?: string;
  note?: string;
}

export interface ConsumablePurchaseItemInput {
  productCode: string;
  description?: string;
  quantity: number;
  unitPrice?: string;
  lineAmount: string;
  expiresOn?: string;
  storageLocation?: string;
}

export interface CreateConsumablePurchaseInput {
  transactionAllocationId: string;
  purchasedAt: string;
  merchant?: string;
  note?: string;
  items: ConsumablePurchaseItemInput[];
}

export interface InventoryOperationResult {
  logId: number;
  productCode: string;
  quantity: number;
  currentStock: number;
  stockEntryCode?: string;
  deductions?: Array<{ stockEntryCode: string; quantity: number }>;
}

export interface StockEntryView { id: number; stockEntryCode: string; productCode: string; productName: string; initialQuantity: number; availableQuantity: number; expiresOn: IsoDate | null; storageLocation: string | null; source: string | null; status: string; createdAt: IsoDateTime; }

export interface InventoryLogView {
  id: number;
  productCode: string;
  productName: string;
  actionType: string;
  quantity: number;
  reason: string | null;
  note: string | null;
  reversed: boolean;
  createdAt: IsoDateTime;
}

export interface ConsumablesSummary {
  productCount: number;
  currentUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  nearExpiryCount: number;
  expiredCount: number;
  replenishList: Array<{ productCode: string; name: string; unit: string; currentStock: number; minStock: number; suggestedQuantity: number }>;
}

export interface ProductGroupView { groupCode: string; name: string; description: string | null; itemCount: number; }

export interface ConsumablesService {
  listProducts(context: ActionContext): Promise<ProductView[]>;
  createProduct(context: ActionContext, input: CreateProductInput): Promise<ProductView>;
  getSummary(context: ActionContext): Promise<ConsumablesSummary>;
  receiveStock(context: ActionContext, input: ReceiveStockInput): Promise<InventoryOperationResult>;
  createPurchase(context: ActionContext, input: CreateConsumablePurchaseInput): Promise<{ id: string; amount: MoneyString }>;
  consumeStock(context: ActionContext, input: { productCode: string; quantity: number }): Promise<InventoryOperationResult>;
  countStock(context: ActionContext, input: { productCode: string; targetQuantity: number; reason?: string }): Promise<InventoryOperationResult>;
  undoInventoryLog(context: ActionContext, logId: number): Promise<InventoryOperationResult>;
  listLogs(context: ActionContext, limit?: number): Promise<InventoryLogView[]>;
  listStockEntries(context: ActionContext, filters?: { productCode?: string; status?: string; attention?: boolean }): Promise<StockEntryView[]>;
  adjustStockEntry(context: ActionContext, id: number, input: { type: "add" | "remove" | "set"; quantity: number; reason?: string; note?: string }): Promise<InventoryOperationResult>;
  listProductGroups(context: ActionContext): Promise<ProductGroupView[]>;
}

export type { IsoDate };
