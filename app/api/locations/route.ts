import { NextResponse } from "next/server";
import { getConsumablesApiContext } from "@/lib/api/consumables";
import { ledgerApiError, requestIdFrom } from "@/lib/api/ledger";
import { listStockEntries } from "@/modules/consumables";
export async function GET(request: Request) { const requestId = requestIdFrom(request); try { const rows = await listStockEntries(await getConsumablesApiContext(request, "consumables.read", requestId)); return NextResponse.json({ success: true, data: [...new Set(rows.flatMap((item) => item.storageLocation ? [item.storageLocation] : []))].sort() }); } catch (error) { return ledgerApiError(error, requestId); } }
