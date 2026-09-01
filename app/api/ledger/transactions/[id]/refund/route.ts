import { NextResponse } from "next/server";

import { apiSuccess } from "@/lib/api/response";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { createRefund } from "@/modules/ledger";
import { createRefundSchema } from "@/modules/ledger/schemas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const parsed = createRefundSchema.safeParse({ ...(await request.json()), originalTransactionId: (await params).id });
    if (!parsed.success) return validationFailure(parsed.error, requestId);
    const result = await createRefund(await getLedgerApiContext(requestId), parsed.data);
    return NextResponse.json(apiSuccess(result, requestId), { status: 201 });
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
