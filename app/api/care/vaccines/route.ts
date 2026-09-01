import { NextResponse } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { createVaccine, listVaccines } from "@/modules/care";
import { vaccineSchema } from "@/modules/care/schemas";
export async function GET(request: Request) { const requestId = requestIdFrom(request); try { const babyProfileId = new URL(request.url).searchParams.get("babyProfileId") || undefined; return NextResponse.json(apiSuccess(await listVaccines(await getLedgerApiContext(requestId), babyProfileId), requestId)); } catch (error) { return ledgerApiError(error, requestId); } }
export async function POST(request: Request) { const requestId = requestIdFrom(request); try { const parsed = vaccineSchema.safeParse(await request.json()); if (!parsed.success) return validationFailure(parsed.error, requestId); return NextResponse.json(apiSuccess(await createVaccine(await getLedgerApiContext(requestId), parsed.data), requestId), { status: 201 }); } catch (error) { return ledgerApiError(error, requestId); } }
