import { NextResponse } from "next/server";
import { getLedgerApiContext, ledgerApiError, requestIdFrom } from "@/lib/api/ledger";
import { apiSuccess } from "@/lib/api/response";
import { getSummary } from "@/modules/consumables";
export async function GET(request: Request) { const requestId = requestIdFrom(request); try { return NextResponse.json(apiSuccess(await getSummary(await getLedgerApiContext(requestId)), requestId)); } catch (error) { return ledgerApiError(error, requestId); } }
