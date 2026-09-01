import { NextResponse } from "next/server";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { apiSuccess } from "@/lib/api/response";
import { adjustStockEntry } from "@/modules/consumables";
import { adjustStockEntrySchema } from "@/modules/consumables/schemas";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { const requestId = requestIdFrom(request); try { const parsed = adjustStockEntrySchema.safeParse(await request.json()); if (!parsed.success) return validationFailure(parsed.error, requestId); return NextResponse.json(apiSuccess(await adjustStockEntry(await getLedgerApiContext(requestId), Number((await params).id), parsed.data), requestId)); } catch (error) { return ledgerApiError(error, requestId); } }
