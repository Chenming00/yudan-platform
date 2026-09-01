import { NextResponse } from "next/server";
import { getConsumablesApiContext } from "@/lib/api/consumables";
import { ledgerApiError, requestIdFrom } from "@/lib/api/ledger";
import { adjustStockEntry } from "@/modules/consumables";
import { adjustStockEntrySchema } from "@/modules/consumables/schemas";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { const requestId = requestIdFrom(request); try { const parsed = adjustStockEntrySchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ success: false, message: "调整类型或数量不正确" }, { status: 400 }); const result = await adjustStockEntry(await getConsumablesApiContext(request, "consumables.write", requestId), Number((await params).id), parsed.data); return NextResponse.json({ success: true, message: "库存调整成功", data: result }); } catch (error) { return ledgerApiError(error, requestId); } }
