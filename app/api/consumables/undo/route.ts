import { NextResponse } from "next/server";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { apiSuccess } from "@/lib/api/response";
import { undoInventoryLog } from "@/modules/consumables";
import { undoSchema } from "@/modules/consumables/schemas";
export async function POST(request: Request) { const requestId = requestIdFrom(request); try { const parsed = undoSchema.safeParse(await request.json()); if (!parsed.success) return validationFailure(parsed.error, requestId); return NextResponse.json(apiSuccess(await undoInventoryLog(await getLedgerApiContext(requestId), parsed.data.logId), requestId)); } catch (error) { return ledgerApiError(error, requestId); } }
