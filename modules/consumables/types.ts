import type { ActionContext, IsoDate, MoneyString } from "@/lib/types/platform";

export type StockEntrySource =
  | "PURCHASE"
  | "GIFT"
  | "TRANSFER"
  | "ADJUSTMENT"
  | "HISTORICAL";

export interface ReceiveStockInput {
  productId: string;
  quantity: number;
  source: StockEntrySource;
  expiresOn?: IsoDate;
  unitCost?: MoneyString;
  purchaseAllocationId?: string;
}

export interface ConsumablesService {
  receiveStock(context: ActionContext, input: ReceiveStockInput): Promise<{ stockEntryId: string }>;
  consumeStock(
    context: ActionContext,
    input: { productId: string; quantity: number; occurredOn: IsoDate },
  ): Promise<void>;
}

