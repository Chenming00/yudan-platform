import { NextResponse } from "next/server";
import { getConsumablesApiContext } from "@/lib/api/consumables";
import { ledgerApiError, requestIdFrom } from "@/lib/api/ledger";
import { undoInventoryLog } from "@/modules/consumables";
export async function POST(request: Request) { const requestId = requestIdFrom(request); try { const body = await request.json(); const result = await undoInventoryLog(await getConsumablesApiContext(request, "consumables.write", requestId), Number(body.log_id)); return NextResponse.json({ success: true, message: "撤销成功", data: result }); } catch (error) { return ledgerApiError(error, requestId); } }
