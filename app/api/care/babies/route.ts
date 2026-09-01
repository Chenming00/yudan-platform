import { NextResponse } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { createBaby, listBabies } from "@/modules/care";
import { babySchema } from "@/modules/care/schemas";
export async function GET(request: Request) { const requestId = requestIdFrom(request); try { return NextResponse.json(apiSuccess(await listBabies(await getLedgerApiContext(requestId)), requestId)); } catch (error) { return ledgerApiError(error, requestId); } }
export async function POST(request: Request) { const requestId = requestIdFrom(request); try { const parsed = babySchema.safeParse(await request.json()); if (!parsed.success) return validationFailure(parsed.error, requestId); return NextResponse.json(apiSuccess(await createBaby(await getLedgerApiContext(requestId), parsed.data), requestId), { status: 201 }); } catch (error) { return ledgerApiError(error, requestId); } }
