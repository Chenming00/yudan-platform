import { NextResponse } from "next/server";

import { apiSuccess } from "@/lib/api/response";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { createTransaction, listTransactions } from "@/modules/ledger";
import { createTransactionSchema, ledgerListSchema } from "@/modules/ledger/schemas";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const url = new URL(request.url);
    const parsed = ledgerListSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return validationFailure(parsed.error, requestId);
    const result = await listTransactions(await getLedgerApiContext(requestId), parsed.data);
    return NextResponse.json(apiSuccess(result, requestId));
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const parsed = createTransactionSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error, requestId);
    const result = await createTransaction(await getLedgerApiContext(requestId), parsed.data);
    return NextResponse.json(apiSuccess(result, requestId), { status: 201 });
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
