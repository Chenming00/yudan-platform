import { NextResponse } from "next/server";

import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { apiSuccess } from "@/lib/api/response";
import { createPurchase, listPurchases } from "@/modules/wardrobe";
import { wardrobePurchaseSchema } from "@/modules/wardrobe/schemas";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const data = await listPurchases(await getLedgerApiContext(requestId));
    return NextResponse.json(apiSuccess(data, requestId));
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const parsed = wardrobePurchaseSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error, requestId);
    const data = await createPurchase(await getLedgerApiContext(requestId), parsed.data);
    return NextResponse.json(apiSuccess(data, requestId), { status: 201 });
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
