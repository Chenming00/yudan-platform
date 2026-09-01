import { NextResponse } from "next/server";
import { createCompositeExpense, compositeExpenseSchema } from "@/application";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { apiSuccess } from "@/lib/api/response";
export async function POST(request: Request) { const requestId = requestIdFrom(request); try { const parsed = compositeExpenseSchema.safeParse(await request.json()); if (!parsed.success) return validationFailure(parsed.error, requestId); const result = await createCompositeExpense(await getLedgerApiContext(requestId), parsed.data); return NextResponse.json(apiSuccess(result, requestId), { status: result.replayed ? 200 : 201 }); } catch (error) { return ledgerApiError(error, requestId); } }
