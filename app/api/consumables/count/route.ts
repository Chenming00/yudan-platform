import { NextResponse } from "next/server";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { apiSuccess } from "@/lib/api/response";
import { countStock } from "@/modules/consumables";
import { countStockSchema } from "@/modules/consumables/schemas";
export async function POST(request: Request) { const requestId = requestIdFrom(request); try { const parsed = countStockSchema.safeParse(await request.json()); if (!parsed.success) return validationFailure(parsed.error, requestId); return NextResponse.json(apiSuccess(await countStock(await getLedgerApiContext(requestId), parsed.data), requestId)); } catch (error) { return ledgerApiError(error, requestId); } }
