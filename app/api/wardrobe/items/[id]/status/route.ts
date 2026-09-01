import { NextResponse } from "next/server";

import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { apiSuccess } from "@/lib/api/response";
import { updateItemStatus } from "@/modules/wardrobe";
import { wardrobeStatusSchema } from "@/modules/wardrobe/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const parsed = wardrobeStatusSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error, requestId);
    const { id } = await params;
    const data = await updateItemStatus(await getLedgerApiContext(requestId), id, parsed.data);
    return NextResponse.json(apiSuccess(data, requestId));
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
