export type MoneyString = string;
export type IsoDate = `${number}-${number}-${number}`;
export type IsoDateTime = string;

export interface ActionContext {
  userId: string;
  householdId: string;
  requestId: string;
  idempotencyKey?: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

