import { ArrowRight, Baby, Boxes, CalendarClock, CircleDollarSign, Layers3, Plus, ReceiptText, Shirt } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { getDashboardOverview } from "@/modules/dashboard";
import type { ExpenseModule } from "@/modules/ledger/types";

const moduleMeta: Record<ExpenseModule, { label: string; icon: typeof Baby; href: string }> = {
  CHILD_CARE: { label: "儿童保健", icon: Baby, href: "/care" },
  WARDROBE: { label: "衣柜", icon: Shirt, href: "/wardrobe" },
  CONSUMABLES: { label: "消耗品", icon: Boxes, href: "/consumables" },
  OTHER: { label: "其他开支", icon: ReceiptText, href: "/ledger" },
};
const eventLabels = { TRANSACTION: "账本", CARE: "保健", WARDROBE: "衣柜", INVENTORY: "库存" } as const;

function currentMonth() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7); }

export default async function DashboardPage() {
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const overview = await getDashboardOverview(createActionContext(actor.userId, householdId), currentMonth());
  const summaries = [{ label: "本月净支出", value: overview.netExpense, icon: CircleDollarSign }, ...overview.byModule.filter((item) => item.module !== "OTHER").map((item) => ({ label: moduleMeta[item.module].label, value: item.amount, icon: moduleMeta[item.module].icon }))];
  return <div className="space-y-6">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-3 flex items-center gap-2"><Badge variant="secondary">家庭空间</Badge><span className="text-xs text-muted-foreground">{overview.month} · {overview.transactionCount} 笔账目</span></div><h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">家庭总览</h1><p className="mt-2 text-sm text-muted-foreground">保健、衣柜、消耗品和其他开支都汇总到同一本账。</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/ledger/new"><Plus />普通记账</Link></Button><Button asChild><Link href="/ledger/new/composite"><Layers3 />组合记账</Link></Button></div></section>
    <section aria-label="本月开支摘要" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{summaries.map(({ label, value, icon: Icon }) => <Card key={label} size="sm"><CardHeader><CardDescription>{label}</CardDescription><CardAction><Icon className="size-4 text-muted-foreground" /></CardAction><CardTitle className="font-mono text-2xl tabular-nums">¥{value}</CardTitle></CardHeader></Card>)}</section>
    <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"><Card><CardHeader><CardTitle>模块支出对比</CardTitle><CardDescription>退款已经从对应模块金额中扣除</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{overview.byModule.map((item) => { const meta = moduleMeta[item.module]; const Icon = meta.icon; return <Link className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-accent/50" href={meta.href} key={item.module}><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-lg bg-muted"><Icon className="size-4" /></div><div><p className="font-medium">{meta.label}</p><p className="font-mono text-xs text-muted-foreground">¥{item.amount}</p></div></div><ArrowRight className="size-4 text-muted-foreground" /></Link>; })}</CardContent></Card><Card><CardHeader><CardTitle>库存提醒</CardTitle><CardDescription>达到安全库存或已经用完的产品</CardDescription></CardHeader><CardContent><Link className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors hover:bg-accent/50" href="/consumables"><CalendarClock className="mb-3 size-7 text-muted-foreground" /><p className="text-sm font-medium">{overview.lowStockCount} 种需要补货，{overview.outOfStockCount} 种已用完</p><p className="mt-1 text-xs text-muted-foreground">查看消耗品补货建议</p></Link></CardContent></Card></section>
    <Card><CardHeader><CardTitle>最近事件</CardTitle><CardDescription>账本和各业务模块按时间统一排列</CardDescription></CardHeader><CardContent className="space-y-2">{overview.recentEvents.map((event) => <Link className="flex items-center justify-between gap-4 rounded-lg border p-3 transition-colors hover:bg-accent/50" href={event.href} key={event.id}><div className="min-w-0"><div className="flex items-center gap-2"><Badge variant="outline">{eventLabels[event.kind]}</Badge><p className="truncate font-medium">{event.title}</p></div><p className="mt-1 text-xs text-muted-foreground">{event.detail}</p></div><time className="shrink-0 text-xs text-muted-foreground">{new Date(event.occurredAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</time></Link>)}{!overview.recentEvents.length ? <p className="py-10 text-center text-sm text-muted-foreground">还没有家庭事件。</p> : null}</CardContent></Card>
  </div>;
}
