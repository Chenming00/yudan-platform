import { NextResponse } from "next/server";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { apiSuccess } from "@/lib/api/response";
import { createProduct, listProducts } from "@/modules/consumables";
import { productSchema } from "@/modules/consumables/schemas";

export async function GET(request: Request) { const requestId = requestIdFrom(request); try { return NextResponse.json(apiSuccess(await listProducts(await getLedgerApiContext(requestId)), requestId)); } catch (error) { return ledgerApiError(error, requestId); } }
export async function POST(request: Request) { const requestId = requestIdFrom(request); try { const parsed = productSchema.safeParse(await request.json()); if (!parsed.success) return validationFailure(parsed.error, requestId); return NextResponse.json(apiSuccess(await createProduct(await getLedgerApiContext(requestId), parsed.data), requestId), { status: 201 }); } catch (error) { return ledgerApiError(error, requestId); } }
