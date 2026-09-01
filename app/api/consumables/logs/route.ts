import { NextResponse } from "next/server";
import { getLedgerApiContext, ledgerApiError, requestIdFrom } from "@/lib/api/ledger";
import { apiSuccess } from "@/lib/api/response";
import { listLogs } from "@/modules/consumables";
export async function GET(request: Request) { const requestId = requestIdFrom(request); try { const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50); return NextResponse.json(apiSuccess(await listLogs(await getLedgerApiContext(requestId), limit), requestId)); } catch (error) { return ledgerApiError(error, requestId); } }
