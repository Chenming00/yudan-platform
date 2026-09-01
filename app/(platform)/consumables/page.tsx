import { AlertTriangle, Boxes, PackageCheck, PackageX, ShoppingCart } from "lucide-react";
import Link from "next/link";

import { InventoryOperationForm } from "@/components/consumables/inventory-operation-form";
import { ProductForm } from "@/components/consumables/product-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { getSummary, listLogs, listProductGroups, listProducts, type ProductStockStatus } from "@/modules/consumables";

const statusLabels: Record<ProductStockStatus, string> = { OK: "库存正常", LOW: "需要补货", OUT: "已经用完" };
const actionLabels: Record<string, string> = { IN: "入库", OUT: "使用", COUNT: "盘点", ADJUST: "调整", UNDO: "撤销" };

export default async function ConsumablesPage() {
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const context = createActionContext(actor.userId, householdId);
  const [summary, products, logs, groups] = await Promise.all([getSummary(context), listProducts(context), listLogs(context, 8), listProductGroups(context)]);

  return (
    <div className="space-y-6">
      <div><p className="text-sm text-muted-foreground">消耗品库存与家庭开支</p><h1 className="font-heading text-2xl font-semibold">消耗品</h1><p className="mt-1 text-sm text-muted-foreground">页面只展示当前库存；系统自动按先到期先使用的顺序扣减内部库存记录。</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm"><CardHeader><CardDescription>产品种类</CardDescription><CardTitle className="flex items-center gap-2"><Boxes className="size-5 text-primary" />{summary.productCount} 种</CardTitle></CardHeader></Card>
        <Card size="sm"><CardHeader><CardDescription>需要补货</CardDescription><CardTitle className="flex items-center gap-2"><ShoppingCart className="size-5 text-primary" />{summary.lowStockCount} 种</CardTitle></CardHeader></Card>
        <Card size="sm"><CardHeader><CardDescription>已经用完</CardDescription><CardTitle className="flex items-center gap-2"><PackageX className="size-5 text-destructive" />{summary.outOfStockCount} 种</CardTitle></CardHeader></Card>
        <Card size="sm"><CardHeader><CardDescription>30 天内到期 / 已过期</CardDescription><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-amber-600" />{summary.nearExpiryCount} / {summary.expiredCount}</CardTitle></CardHeader></Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card><CardHeader><CardTitle>当前库存</CardTitle><CardDescription>点击产品可查看详情和管理私有图片</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>产品</TableHead><TableHead>分类</TableHead><TableHead>当前库存</TableHead><TableHead>到期提醒</TableHead><TableHead>状态</TableHead></TableRow></TableHeader><TableBody>{products.length ? products.map((product) => <TableRow key={product.productCode}><TableCell><Link className="font-medium hover:underline" href={`/consumables/${product.productCode}`}>{product.name}</Link><p className="text-xs text-muted-foreground">{product.spec ?? `编号 ${product.productCode}`}</p></TableCell><TableCell>{product.category}</TableCell><TableCell>{product.currentStock} {product.unit}</TableCell><TableCell>{product.expiredQuantity > 0 ? `${product.expiredQuantity} ${product.unit} 已过期` : product.nearestExpiryDays === null ? "无到期日" : `${product.nearestExpiryDays} 天`}</TableCell><TableCell><Badge variant={product.stockStatus === "OUT" ? "destructive" : product.stockStatus === "LOW" ? "secondary" : "outline"}>{statusLabels[product.stockStatus]}</Badge></TableCell></TableRow>) : <TableRow><TableCell className="h-28 text-center text-muted-foreground" colSpan={5}>还没有产品，可以先在下方创建第一种消耗品。</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle>库存操作</CardTitle><CardDescription>采购必须关联一笔“消耗品”账本分摊</CardDescription></CardHeader><CardContent><InventoryOperationForm products={products.map(({ productCode, name, currentStock, unit }) => ({ productCode, name, currentStock, unit }))} /></CardContent></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="size-5" />补货建议</CardTitle><CardDescription>达到安全库存时自动出现，已关闭提醒的产品除外</CardDescription></CardHeader><CardContent className="space-y-3">{summary.replenishList.map((item) => <div className="flex items-center justify-between gap-4 rounded-lg border p-3" key={item.productCode}><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">现有 {item.currentStock}，安全库存 {item.minStock}</p></div><Badge variant="secondary">建议买 {item.suggestedQuantity} {item.unit}</Badge></div>)}{!summary.replenishList.length ? <p className="text-sm text-muted-foreground">目前没有需要补货的产品。</p> : null}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><PackageCheck className="size-5" />最近操作</CardTitle><CardDescription>库存变化均保留审计日志</CardDescription></CardHeader><CardContent className="space-y-3">{logs.map((log) => <div className="flex items-center justify-between gap-4 rounded-lg border p-3" key={log.id}><div><p className="font-medium">{log.productName}</p><p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}{log.reversed ? " · 已撤销" : ""}</p></div><Badge variant="outline">{actionLabels[log.actionType] ?? log.actionType} {log.quantity}</Badge></div>)}{!logs.length ? <p className="text-sm text-muted-foreground">还没有库存操作。</p> : null}</CardContent></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>创建产品</CardTitle><CardDescription>批次和内部库存记录不会出现在日常表单中</CardDescription></CardHeader><CardContent><ProductForm /></CardContent></Card><Card><CardHeader><CardTitle>产品组</CardTitle><CardDescription>用于整理常用的组合清单</CardDescription></CardHeader><CardContent className="space-y-3">{groups.map((group) => <div className="rounded-lg border p-3" key={group.groupCode}><div className="flex items-center justify-between"><p className="font-medium">{group.name}</p><Badge variant="outline">{group.itemCount} 项</Badge></div><p className="mt-1 text-xs text-muted-foreground">{group.description ?? group.groupCode}</p></div>)}{!groups.length ? <p className="text-sm text-muted-foreground">还没有产品组，可通过兼容 API 创建。</p> : null}</CardContent></Card></div>
    </div>
  );
}
