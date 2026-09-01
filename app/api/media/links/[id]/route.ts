import { NextResponse } from "next/server";

import { apiSuccess } from "@/lib/api/response";
import { getLedgerApiContext, ledgerApiError, requestIdFrom } from "@/lib/api/ledger";
import { unlinkMedia } from "@/modules/media";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    await unlinkMedia(await getLedgerApiContext(requestId), (await params).id);
    return NextResponse.json(apiSuccess({ unlinked: true }, requestId));
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
