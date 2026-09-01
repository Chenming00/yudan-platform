import { NextResponse } from "next/server";
import { getConsumablesApiContext } from "@/lib/api/consumables";
import { ledgerApiError, requestIdFrom } from "@/lib/api/ledger";
import { consumeStock } from "@/modules/consumables";
import { consumeStockSchema } from "@/modules/consumables/schemas";
export async function POST(request: Request) { const requestId = requestIdFrom(request); try { const body = await request.json(); const parsed = consumeStockSchema.safeParse({ productCode: body.product_code, quantity: Number(body.quantity) }); if (!parsed.success) return NextResponse.json({ success: false, message: "商品和数量必填" }, { status: 400 }); const result = await consumeStock(await getConsumablesApiContext(request, "consumables.write", requestId), parsed.data); return NextResponse.json({ success: true, message: `出库成功，共消耗 ${result.quantity} 件`, data: { logId: result.logId, deducted: result.quantity, current_stock: result.currentStock, deductions: result.deductions?.map((item) => ({ batch_code: item.stockEntryCode, deducted: item.quantity })) ?? [] } }); } catch (error) { return ledgerApiError(error, requestId); } }
