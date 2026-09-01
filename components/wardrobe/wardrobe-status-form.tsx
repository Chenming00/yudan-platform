"use client";

import { CircleAlert, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WardrobeItemStatus } from "@/modules/wardrobe";

const labels: Record<WardrobeItemStatus, string> = { ACTIVE: "使用中", STORED: "已收纳", DONATED: "已捐赠", SOLD: "已出售", DISCARDED: "已淘汰" };

export function WardrobeStatusForm({ itemId, currentStatus }: { itemId: string; currentStatus: WardrobeItemStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<WardrobeItemStatus>(currentStatus);
  const [saleAllocationId, setSaleAllocationId] = useState("");
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const terminal = ["DONATED", "SOLD", "DISCARDED"].includes(currentStatus);
  function submit() {
    startTransition(async () => {
      setMessage(undefined);
      const response = await fetch(`/api/wardrobe/items/${itemId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, saleTransactionAllocationId: status === "SOLD" ? saleAllocationId : undefined }),
      });
      const body = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok || !body.success) return setMessage(body.error?.message ?? "状态更新失败。");
      router.refresh();
    });
  }
  if (terminal) return <p className="text-sm text-muted-foreground">当前状态“{labels[currentStatus]}”是终态；如需修正请由管理员核对审计记录后处理。</p>;
  return (
    <div className="space-y-4">
      {message ? <Alert variant="destructive"><CircleAlert /><AlertTitle>无法更新</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}
      <div className="grid gap-2"><Label>新状态</Label><Select onValueChange={(value) => setStatus(value as WardrobeItemStatus)} value={status}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">使用中</SelectItem><SelectItem value="STORED">已收纳</SelectItem><SelectItem value="DONATED">已捐赠</SelectItem><SelectItem value="SOLD">已出售</SelectItem><SelectItem value="DISCARDED">已淘汰</SelectItem></SelectContent></Select></div>
      {status === "SOLD" ? <div className="grid gap-2"><Label htmlFor="sale-allocation">收入 Allocation ID</Label><Input id="sale-allocation" onChange={(event) => setSaleAllocationId(event.target.value)} placeholder="先在账本创建 WARDROBE 收入" value={saleAllocationId} /></div> : null}
      <Button disabled={pending || status === currentStatus} onClick={submit} type="button"><Save />{pending ? "更新中…" : "更新状态"}</Button>
    </div>
  );
}
