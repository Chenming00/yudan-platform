import { NextResponse } from "next/server";

import { apiSuccess } from "@/lib/api/response";
import { getLedgerApiContext, ledgerApiError, requestIdFrom } from "@/lib/api/ledger";
import { deleteMedia } from "@/modules/media";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    await deleteMedia(await getLedgerApiContext(requestId), (await params).id);
    return NextResponse.json(apiSuccess({ deleted: true }, requestId));
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
