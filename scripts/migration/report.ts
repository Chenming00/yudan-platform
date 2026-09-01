import { mapLegacyCategory } from "./category-map";

export type LedgerReportRow = {
  amount: string;
  category: string | null;
  type: "expense" | "income";
  occurredAt: Date;
};

export type PantryReport = {
  productCount: number;
  stockEntryCount: number;
  inventoryLogCount: number;
  productGroupCount: number;
  productGroupItemCount: number;
  availableQuantity: number;
  platformSchemaReady: boolean;
  stockByProduct: Array<{ productCode: string; availableQuantity: number }>;
};

function decimalToCents(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error(`Invalid two-decimal money value: ${value}`);
  const sign = match[1] === "-" ? BigInt(-1) : BigInt(1);
  return sign * (BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0")));
}

function centsToDecimal(value: bigint) {
  const zero = BigInt(0);
  const hundred = BigInt(100);
  const sign = value < zero ? "-" : "";
  const absolute = value < zero ? -value : value;
  return `${sign}${absolute / hundred}.${String(absolute % hundred).padStart(2, "0")}`;
}

function monthKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error(`Unable to determine month for ${date.toISOString()}`);
  return `${year}-${month}`;
}

export function buildLedgerReport(rows: LedgerReportRow[], timeZone = "Asia/Shanghai") {
  const byModule: Record<string, number> = {};
  const byMonth = new Map<string, { count: number; income: bigint; expense: bigint }>();
  let income = BigInt(0);
  let expense = BigInt(0);

  for (const row of rows) {
    const amount = decimalToCents(row.amount);
    if (row.type === "income") income += amount;
    else expense += amount;

    const allocationModule = mapLegacyCategory(row.category).module;
    byModule[allocationModule] = (byModule[allocationModule] ?? 0) + 1;
    const month = monthKey(row.occurredAt, timeZone);
    const current = byMonth.get(month) ?? { count: 0, income: BigInt(0), expense: BigInt(0) };
    current.count += 1;
    current[row.type] += amount;
    byMonth.set(month, current);
  }

  return {
    count: rows.length,
    income: centsToDecimal(income),
    expense: centsToDecimal(expense),
    byModule,
    byMonth: [...byMonth.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([month, value]) => ({
      month,
      count: value.count,
      income: centsToDecimal(value.income),
      expense: centsToDecimal(value.expense),
    })),
  };
}

export function buildMigrationChecks(input: {
  ledgerCount: number;
  babyProfiles: number;
  distinctBirthdays: number;
  pantry: PantryReport;
}) {
  const checks = [
    { name: "ledger-source-not-empty", status: input.ledgerCount > 0 ? "PASS" : "BLOCKED" },
    { name: "single-baby-birthday", status: input.babyProfiles > 0 && input.distinctBirthdays === 1 ? "PASS" : "BLOCKED" },
    { name: "pantry-products-preserved", status: input.pantry.productCount > 0 ? "PASS" : "BLOCKED" },
    { name: "pantry-stock-nonnegative", status: input.pantry.stockByProduct.every((row) => row.availableQuantity >= 0) ? "PASS" : "BLOCKED" },
    { name: "platform-schema-ready", status: input.pantry.platformSchemaReady ? "PASS" : "BLOCKED" },
  ] as const;

  return {
    checks,
    safeToApply: checks.every((check) => check.status === "PASS"),
  };
}
