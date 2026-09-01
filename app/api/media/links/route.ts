import { NextResponse } from "next/server";

import { apiSuccess } from "@/lib/api/response";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { linkMedia, listMediaForEntity } from "@/modules/media";
import { mediaLinkSchema } from "@/modules/media/schemas";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const url = new URL(request.url);
    const parsed = mediaLinkSchema.pick({ entityType: true, entityId: true }).safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return validationFailure(parsed.error, requestId);
    const result = await listMediaForEntity(await getLedgerApiContext(requestId), parsed.data.entityType, parsed.data.entityId);
    return NextResponse.json(apiSuccess(result, requestId));
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const parsed = mediaLinkSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error, requestId);
    await linkMedia(await getLedgerApiContext(requestId), parsed.data);
    return NextResponse.json(apiSuccess({ linked: true }, requestId), { status: 201 });
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
