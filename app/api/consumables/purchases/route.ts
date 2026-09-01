import { NextResponse } from "next/server";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { apiSuccess } from "@/lib/api/response";
import { createPurchase } from "@/modules/consumables";
import { consumablePurchaseSchema } from "@/modules/consumables/schemas";
export async function POST(request: Request) { const requestId = requestIdFrom(request); try { const parsed = consumablePurchaseSchema.safeParse(await request.json()); if (!parsed.success) return validationFailure(parsed.error, requestId); return NextResponse.json(apiSuccess(await createPurchase(await getLedgerApiContext(requestId), parsed.data), requestId), { status: 201 }); } catch (error) { return ledgerApiError(error, requestId); } }
