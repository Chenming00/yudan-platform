import { NextResponse } from "next/server";

import { apiSuccess } from "@/lib/api/response";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { AppError } from "@/lib/errors/app-error";
import { deleteTransaction, getTransaction, updateTransaction } from "@/modules/ledger";
import { updateTransactionSchema } from "@/modules/ledger/schemas";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const result = await getTransaction(await getLedgerApiContext(requestId), (await params).id);
    if (!result) throw new AppError("RESOURCE_NOT_FOUND", "账目不存在。" );
    return NextResponse.json(apiSuccess(result, requestId));
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const parsed = updateTransactionSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error, requestId);
    const result = await updateTransaction(await getLedgerApiContext(requestId), (await params).id, parsed.data);
    return NextResponse.json(apiSuccess(result, requestId));
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    await deleteTransaction(await getLedgerApiContext(requestId), (await params).id);
    return NextResponse.json(apiSuccess({ deleted: true }, requestId));
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
