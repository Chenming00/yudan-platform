import { NextResponse } from "next/server";

import { apiSuccess } from "@/lib/api/response";
import { getLedgerApiContext, ledgerApiError, requestIdFrom } from "@/lib/api/ledger";
import { getLedgerSummary } from "@/modules/ledger";

function currentShanghaiMonth() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" }).formatToParts();
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const month = new URL(request.url).searchParams.get("month") || currentShanghaiMonth();
    const result = await getLedgerSummary(await getLedgerApiContext(requestId), month);
    return NextResponse.json(apiSuccess(result, requestId));
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
