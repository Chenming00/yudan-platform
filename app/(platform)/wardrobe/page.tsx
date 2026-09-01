import { Archive, Gift, PackageOpen, Shirt } from "lucide-react";
import Link from "next/link";

import { WardrobeEntryForm } from "@/components/wardrobe/wardrobe-entry-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { listBabies } from "@/modules/care";
import { listItems, listPurchases, type WardrobeItemStatus } from "@/modules/wardrobe";

const statusLabels: Record<WardrobeItemStatus, string> = { ACTIVE: "使用中", STORED: "已收纳", DONATED: "已捐赠", SOLD: "已出售", DISCARDED: "已淘汰" };

export default async function WardrobePage() {
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const context = createActionContext(actor.userId, householdId);
  const [items, purchases, babies] = await Promise.all([listItems(context), listPurchases(context), listBabies(context)]);
  const activeQuantity = items.filter((item) => item.status === "ACTIVE").reduce((sum, item) => sum + item.quantity, 0);
  const storedQuantity = items.filter((item) => item.status === "STORED").reduce((sum, item) => sum + item.quantity, 0);
  const giftedQuantity = items.filter((item) => item.acquisition === "GIFTED").reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">衣物档案与购衣开支</p>
        <h1 className="font-heading text-2xl font-semibold">儿童衣柜</h1>
        <p className="mt-1 text-sm text-muted-foreground">购买关联统一账本，赠送直接入柜；图片始终使用私有资源。</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm"><CardHeader><CardDescription>衣物种类</CardDescription><CardTitle className="flex items-center gap-2"><Shirt className="size-5 text-primary" />{items.length} 种</CardTitle></CardHeader></Card>
        <Card size="sm"><CardHeader><CardDescription>正在使用</CardDescription><CardTitle>{activeQuantity} 件</CardTitle></CardHeader></Card>
        <Card size="sm"><CardHeader><CardDescription>已经收纳</CardDescription><CardTitle className="flex items-center gap-2"><Archive className="size-5 text-primary" />{storedQuantity} 件</CardTitle></CardHeader></Card>
        <Card size="sm"><CardHeader><CardDescription>亲友赠送</CardDescription><CardTitle className="flex items-center gap-2"><Gift className="size-5 text-primary" />{giftedQuantity} 件</CardTitle></CardHeader></Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader><CardTitle>衣物清单</CardTitle><CardDescription>点击衣物可管理私有图片与状态</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>衣物</TableHead><TableHead>宝宝</TableHead><TableHead>尺码 / 季节</TableHead><TableHead>来源</TableHead><TableHead>状态</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.length ? items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell><Link className="font-medium hover:underline" href={`/wardrobe/${item.id}`}>{item.name}</Link><p className="text-xs text-muted-foreground">{item.category ?? "未分类"} · {item.quantity} 件</p></TableCell>
                    <TableCell>{item.babyName ?? "家庭共用"}</TableCell>
                    <TableCell>{[item.size, item.season].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{item.acquisition === "PURCHASED" ? "购买" : "赠送"}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{statusLabels[item.status]}</Badge></TableCell>
                  </TableRow>
                )) : <TableRow><TableCell className="h-28 text-center text-muted-foreground" colSpan={5}>衣柜还是空的，可以从右侧添加第一件衣物。</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>添加衣物</CardTitle><CardDescription>购买和赠送采用不同的账本规则</CardDescription></CardHeader><CardContent><WardrobeEntryForm babies={babies} /></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><PackageOpen className="size-5" />最近购买</CardTitle><CardDescription>退款只影响账本净支出，原购买档案继续保留</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {purchases.slice(0, 6).map((purchase) => <div className="rounded-lg border p-3" key={purchase.id}><div className="flex justify-between gap-3"><p className="font-medium">{purchase.merchant ?? "未填写商家"}</p><Badge variant="outline">¥{purchase.amount}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{new Date(purchase.purchasedAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })} · {purchase.itemCount} 种衣物</p></div>)}
          {!purchases.length ? <p className="text-sm text-muted-foreground">还没有关联账本的购买记录。</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
