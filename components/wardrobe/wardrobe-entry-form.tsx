"use client";

import { CircleAlert, CircleCheck, Plus } from "lucide-react";
import { useActionState, useState } from "react";

import { createWardrobeEntryAction, type WardrobeFormState } from "@/app/(platform)/wardrobe/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState: WardrobeFormState = { status: "idle" };

function localDateTime() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

export function WardrobeEntryForm({ babies }: { babies: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(createWardrobeEntryAction, initialState);
  const [source, setSource] = useState("GIFTED");
  return (
    <form action={action} className="space-y-5">
      {state.status !== "idle" ? (
        <Alert variant={state.status === "error" ? "destructive" : "default"}>
          {state.status === "error" ? <CircleAlert /> : <CircleCheck />}
          <AlertTitle>{state.status === "error" ? "无法保存" : "保存成功"}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>来源</Label>
          <Select name="source" onValueChange={setSource} value={source}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="GIFTED">亲友赠送</SelectItem><SelectItem value="PURCHASED">购买</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>所属宝宝</Label>
          <Select defaultValue="NONE" name="babyProfileId">
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="NONE">家庭共用</SelectItem>{babies.map((baby) => <SelectItem key={baby.id} value={baby.id}>{baby.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2"><Label htmlFor="wardrobe-name">衣物名称</Label><Input id="wardrobe-name" name="name" placeholder="例如：蓝色羽绒服" required /></div>
        <div className="grid gap-2"><Label htmlFor="wardrobe-category">品类</Label><Input id="wardrobe-category" name="category" placeholder="外套、裤子、鞋帽…" /></div>
        <div className="grid gap-2"><Label htmlFor="wardrobe-size">尺码</Label><Input id="wardrobe-size" name="size" placeholder="90、100、2T…" /></div>
        <div className="grid gap-2"><Label htmlFor="wardrobe-season">季节</Label><Input id="wardrobe-season" name="season" placeholder="春秋、冬季…" /></div>
        <div className="grid gap-2"><Label htmlFor="wardrobe-color">颜色</Label><Input id="wardrobe-color" name="color" /></div>
        <div className="grid gap-2"><Label htmlFor="wardrobe-quantity">数量</Label><Input defaultValue="1" id="wardrobe-quantity" max="100" min="1" name="quantity" required type="number" /></div>
      </div>
      {source === "PURCHASED" ? (
        <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="wardrobe-purchased-at">购买时间</Label><Input defaultValue={localDateTime()} id="wardrobe-purchased-at" name="purchasedAt" required type="datetime-local" /></div>
          <div className="grid gap-2"><Label htmlFor="wardrobe-merchant">商家</Label><Input id="wardrobe-merchant" name="merchant" /></div>
          <div className="grid gap-2 sm:col-span-2"><Label htmlFor="wardrobe-allocation">账本 Allocation ID</Label><Input id="wardrobe-allocation" name="transactionAllocationId" placeholder="先在账本创建 WARDROBE 支出" required /><p className="text-xs text-muted-foreground">购买记录只关联账本金额，不重复保存费用。</p></div>
        </div>
      ) : null}
      <div className="grid gap-2"><Label htmlFor="wardrobe-note">备注</Label><Textarea id="wardrobe-note" name="note" placeholder="材质、适穿情况或赠送人等" /></div>
      <Button disabled={pending} type="submit"><Plus />{pending ? "保存中…" : "添加衣物"}</Button>
    </form>
  );
}
