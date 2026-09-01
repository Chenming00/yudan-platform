import { NextResponse } from "next/server";

import { apiSuccess } from "@/lib/api/response";
import { getLedgerApiContext, ledgerApiError, requestIdFrom } from "@/lib/api/ledger";
import { createDownloadUrl } from "@/modules/media";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const result = await createDownloadUrl(await getLedgerApiContext(requestId), (await params).id);
    return NextResponse.json(apiSuccess(result, requestId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
