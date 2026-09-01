"use client";

import { CircleAlert, CircleCheck, Save, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { inventoryOperationAction, type ConsumablesFormState } from "@/app/(platform)/consumables/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductView } from "@/modules/consumables";

const initial: ConsumablesFormState = { status: "idle" };
const now = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
type ProductOption = Pick<ProductView, "productCode" | "name" | "currentStock" | "unit">;
export function InventoryOperationForm({ products }: { products: ProductOption[] }) {
  const [state, action, pending] = useActionState(inventoryOperationAction, initial);
  const [operation, setOperation] = useState("CONSUME");
  const [undoMessage, setUndoMessage] = useState<string>();
  const [undoPending, startUndo] = useTransition();
  const router = useRouter();

  function undo() {
    if (!state.logId) return;
    startUndo(async () => {
      try {
        const response = await fetch("/api/consumables/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logId: state.logId }) });
        const body = await response.json() as { error?: { message?: string } };
        setUndoMessage(response.ok ? "库存操作已撤销。" : body.error?.message ?? "撤销失败。");
        if (response.ok) router.refresh();
      } catch {
        setUndoMessage("网络连接失败，未能撤销。");
      }
    });
  }
  return <form action={action} className="space-y-4" onSubmit={() => setUndoMessage(undefined)}>
    {state.status !== "idle" ? <Alert variant={state.status === "error" ? "destructive" : "default"}>{state.status === "error" ? <CircleAlert /> : <CircleCheck />}<AlertTitle>{state.status === "error" ? "操作失败" : "操作成功"}</AlertTitle><AlertDescription className="space-y-2"><p>{undoMessage ?? state.message}</p>{state.logId && !undoMessage ? <Button disabled={undoPending} onClick={undo} size="sm" type="button" variant="outline"><Undo2 />{undoPending ? "撤销中…" : "30 秒内撤销"}</Button> : null}</AlertDescription></Alert> : null}
    <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>操作</Label><Select name="operation" onValueChange={setOperation} value={operation}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CONSUME">使用 / 出库</SelectItem><SelectItem value="RECEIVE">赠送或转入</SelectItem><SelectItem value="PURCHASE">采购入库</SelectItem><SelectItem value="COUNT">盘点库存</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>产品</Label><Select name="productCode" required><SelectTrigger className="w-full"><SelectValue placeholder="选择产品" /></SelectTrigger><SelectContent>{products.map((item) => <SelectItem key={item.productCode} value={item.productCode}>{item.name}（{item.currentStock} {item.unit}）</SelectItem>)}</SelectContent></Select></div></div>
    <div className="grid gap-2"><Label htmlFor="inventory-quantity">{operation === "COUNT" ? "盘点后的实际库存" : "数量"}</Label><Input id="inventory-quantity" max="99999" min={operation === "COUNT" ? "0" : "1"} name="quantity" required type="number" /></div>
    {operation === "RECEIVE" ? <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>来源</Label><Select defaultValue="GIFT" name="source"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GIFT">亲友赠送</SelectItem><SelectItem value="TRANSFER">转入</SelectItem><SelectItem value="HISTORICAL">历史补录</SelectItem><SelectItem value="ADJUSTMENT">库存调整</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="source-label">来源说明</Label><Input id="source-label" name="sourceLabel" /></div></div> : null}
    {operation === "PURCHASE" ? <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="purchase-time">购买时间</Label><Input defaultValue={now()} id="purchase-time" name="purchasedAt" required type="datetime-local" /></div><div className="grid gap-2"><Label htmlFor="purchase-merchant">商家</Label><Input id="purchase-merchant" name="merchant" /></div><div className="grid gap-2"><Label htmlFor="line-amount">本产品金额</Label><Input id="line-amount" name="lineAmount" placeholder="0.00" required /></div><div className="grid gap-2"><Label htmlFor="consumables-allocation">账本 Allocation ID</Label><Input id="consumables-allocation" name="transactionAllocationId" required /></div></div> : null}
    {["RECEIVE", "PURCHASE"].includes(operation) ? <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="stock-expiry">到期日（可选）</Label><Input id="stock-expiry" name="expiresOn" type="date" /></div><div className="grid gap-2"><Label htmlFor="stock-location">存放位置</Label><Input id="stock-location" name="storageLocation" /></div></div> : null}
    {operation === "COUNT" ? <div className="grid gap-2"><Label htmlFor="count-reason">盘点原因</Label><Input id="count-reason" name="reason" /></div> : null}
    <Button disabled={pending} type="submit"><Save />{pending ? "处理中…" : "确认操作"}</Button>
  </form>;
}
