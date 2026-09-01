import { AppError } from "@/lib/errors/app-error";

export interface LedgerCursor {
  transactionAt: string;
  id: string;
}

export function encodeLedgerCursor(cursor: LedgerCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeLedgerCursor(value: string): LedgerCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as LedgerCursor;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.transactionAt !== "string" ||
      Number.isNaN(new Date(parsed.transactionAt).getTime())
    ) throw new Error("invalid cursor");
    return parsed;
  } catch {
    throw new AppError("VALIDATION_FAILED", "分页游标无效。" );
  }
}
