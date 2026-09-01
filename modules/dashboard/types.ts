import type { ExpenseModule } from "@/modules/ledger/types";

export interface DashboardEvent {
  id: string;
  kind: "TRANSACTION" | "CARE" | "WARDROBE" | "INVENTORY";
  title: string;
  detail: string;
  occurredAt: string;
  href: string;
}

export interface DashboardOverview {
  month: string;
  netExpense: string;
  transactionCount: number;
  byModule: Array<{ module: ExpenseModule; amount: string }>;
  lowStockCount: number;
  outOfStockCount: number;
  recentEvents: DashboardEvent[];
}
