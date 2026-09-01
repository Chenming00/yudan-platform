import { ArrowLeft, Boxes, ImageIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductImageUploader } from "@/components/consumables/product-image-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { listProducts } from "@/modules/consumables";
import { listMediaForEntity } from "@/modules/media";

export default async function ConsumableProductPage({ params }: { params: Promise<{ code: string }> }) {
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const context = createActionContext(actor.userId, householdId);
  const { code } = await params;
  const [products, media] = await Promise.all([listProducts(context), listMediaForEntity(context, "PRODUCT", code)]);
  const product = products.find((item) => item.productCode === code);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <Button asChild size="sm" variant="ghost"><Link href="/consumables"><ArrowLeft />返回消耗品</Link></Button>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">产品详情 · {product.productCode}</p><h1 className="font-heading text-2xl font-semibold">{product.name}</h1><p className="mt-1 text-sm text-muted-foreground">{product.category} · {product.spec ?? "未填写规格"}</p></div><Badge variant={product.stockStatus === "OUT" ? "destructive" : "outline"}>{product.currentStock} {product.unit}</Badge></div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="size-5" />库存信息</CardTitle><CardDescription>过期库存不会参与日常可用库存和自动出库</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-muted-foreground">当前库存</p><p>{product.currentStock} {product.unit}</p></div><div><p className="text-xs text-muted-foreground">安全库存</p><p>{product.minStock} {product.unit}</p></div><div><p className="text-xs text-muted-foreground">最近到期</p><p>{product.nearestExpiryDays === null ? "无到期日" : `${product.nearestExpiryDays} 天`}</p></div><div><p className="text-xs text-muted-foreground">已过期</p><p>{product.expiredQuantity} {product.unit}</p></div>{product.barcode ? <div><p className="text-xs text-muted-foreground">条码</p><p>{product.barcode}</p></div> : null}{product.note ? <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">备注</p><p>{product.note}</p></div> : null}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ImageIcon className="size-5" />私有图片</CardTitle><CardDescription>文件存入 Cloudflare R2 私有桶，查看时临时授权</CardDescription></CardHeader><CardContent className="grid gap-6 lg:grid-cols-2"><ProductImageUploader productCode={product.productCode} /><div className="space-y-2">{media.map((asset) => <div className="rounded-lg border p-3" key={asset.id}><p className="font-medium">{asset.originalName ?? "未命名文件"}</p><p className="text-xs text-muted-foreground">{asset.mimeType} · {Math.ceil(Number(asset.byteSize) / 1024)} KB</p></div>)}{!media.length ? <p className="text-sm text-muted-foreground">还没有图片。</p> : null}</div></CardContent></Card>
    </div>
  );
}
