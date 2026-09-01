import { NextResponse } from "next/server";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { apiSuccess } from "@/lib/api/response";
import { consumeStock } from "@/modules/consumables";
import { consumeStockSchema } from "@/modules/consumables/schemas";
export async function POST(request: Request) { const requestId = requestIdFrom(request); try { const parsed = consumeStockSchema.safeParse(await request.json()); if (!parsed.success) return validationFailure(parsed.error, requestId); return NextResponse.json(apiSuccess(await consumeStock(await getLedgerApiContext(requestId), parsed.data), requestId)); } catch (error) { return ledgerApiError(error, requestId); } }
