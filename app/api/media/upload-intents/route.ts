import { NextResponse } from "next/server";

import { apiSuccess } from "@/lib/api/response";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { createUploadIntent } from "@/modules/media";
import { uploadIntentSchema } from "@/modules/media/schemas";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const parsed = uploadIntentSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error, requestId);
    const result = await createUploadIntent(await getLedgerApiContext(requestId), parsed.data);
    return NextResponse.json(apiSuccess(result, requestId), { status: 201 });
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
