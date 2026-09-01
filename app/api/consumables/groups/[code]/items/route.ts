import { NextResponse } from "next/server";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { apiSuccess } from "@/lib/api/response";
import { addProductGroupItem } from "@/modules/consumables";
import { productGroupItemSchema } from "@/modules/consumables/schemas";
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) { const requestId = requestIdFrom(request); try { const parsed = productGroupItemSchema.safeParse(await request.json()); if (!parsed.success) return validationFailure(parsed.error, requestId); return NextResponse.json(apiSuccess(await addProductGroupItem(await getLedgerApiContext(requestId), (await params).code, parsed.data), requestId), { status: 201 }); } catch (error) { return ledgerApiError(error, requestId); } }
