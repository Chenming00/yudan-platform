import { ArrowLeft, ImageIcon, Shirt } from "lucide-react";
import Link from "next/link";

import { WardrobeImageUploader } from "@/components/wardrobe/wardrobe-image-uploader";
import { WardrobeStatusForm } from "@/components/wardrobe/wardrobe-status-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { listMediaForEntity } from "@/modules/media";
import { getItem, type WardrobeItemStatus } from "@/modules/wardrobe";

const statusLabels: Record<WardrobeItemStatus, string> = { ACTIVE: "使用中", STORED: "已收纳", DONATED: "已捐赠", SOLD: "已出售", DISCARDED: "已淘汰" };

export default async function WardrobeItemPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const context = createActionContext(actor.userId, householdId);
  const { id } = await params;
  const [item, media] = await Promise.all([getItem(context, id), listMediaForEntity(context, "WARDROBE_ITEM", id)]);
  return (
    <div className="space-y-6">
      <Button asChild size="sm" variant="ghost"><Link href="/wardrobe"><ArrowLeft />返回衣柜</Link></Button>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">衣物详情</p><h1 className="font-heading text-2xl font-semibold">{item.name}</h1><p className="mt-1 text-sm text-muted-foreground">{item.babyName ?? "家庭共用"} · {item.quantity} 件</p></div><Badge variant="outline">{statusLabels[item.status]}</Badge></div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Shirt className="size-5" />衣物信息</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">品类</p><p>{item.category ?? "—"}</p></div><div><p className="text-xs text-muted-foreground">尺码</p><p>{item.size ?? "—"}</p></div><div><p className="text-xs text-muted-foreground">季节</p><p>{item.season ?? "—"}</p></div><div><p className="text-xs text-muted-foreground">颜色</p><p>{item.color ?? "—"}</p></div><div><p className="text-xs text-muted-foreground">来源</p><p>{item.acquisition === "PURCHASED" ? "购买" : "亲友赠送"}</p></div><div><p className="text-xs text-muted-foreground">购衣账本</p><p>{item.purchaseAmount ? `¥${item.purchaseAmount}` : "不产生支出"}</p></div>{item.note ? <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">备注</p><p>{item.note}</p></div> : null}</CardContent></Card>
        <Card><CardHeader><CardTitle>状态流转</CardTitle><CardDescription>出售必须关联一笔衣柜收入</CardDescription></CardHeader><CardContent><WardrobeStatusForm currentStatus={item.status} itemId={item.id} /></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ImageIcon className="size-5" />私有图片</CardTitle><CardDescription>文件存入 Cloudflare R2 私有桶，访问时临时授权</CardDescription></CardHeader><CardContent className="grid gap-6 lg:grid-cols-2"><WardrobeImageUploader itemId={item.id} /><div className="space-y-2">{media.map((asset) => <div className="rounded-lg border p-3" key={asset.id}><p className="font-medium">{asset.originalName ?? "未命名文件"}</p><p className="text-xs text-muted-foreground">{asset.mimeType} · {Math.ceil(Number(asset.byteSize) / 1024)} KB</p></div>)}{!media.length ? <p className="text-sm text-muted-foreground">还没有图片。</p> : null}</div></CardContent></Card>
    </div>
  );
}
