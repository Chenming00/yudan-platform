import { NextResponse } from "next/server";

import { apiSuccess } from "@/lib/api/response";
import { getLedgerApiContext, ledgerApiError, requestIdFrom } from "@/lib/api/ledger";
import { confirmUpload } from "@/modules/media";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const result = await confirmUpload(await getLedgerApiContext(requestId), (await params).id);
    return NextResponse.json(apiSuccess(result, requestId));
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
