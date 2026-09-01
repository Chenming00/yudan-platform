import { NextResponse } from "next/server";
import { getLedgerApiContext, ledgerApiError, requestIdFrom } from "@/lib/api/ledger";
import { apiSuccess } from "@/lib/api/response";
import { getDashboardOverview } from "@/modules/dashboard";
export async function GET(request: Request) { const requestId = requestIdFrom(request); try { const month = new URL(request.url).searchParams.get("month") ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7); return NextResponse.json(apiSuccess(await getDashboardOverview(await getLedgerApiContext(requestId), month), requestId)); } catch (error) { return ledgerApiError(error, requestId); } }
