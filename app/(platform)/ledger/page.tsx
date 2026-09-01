import { ArrowDownLeft, ArrowUpRight, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";

import { LedgerFilters } from "@/components/ledger/ledger-filters";
import { formatCurrency, moduleLabels, transactionTypeLabels } from "@/components/ledger/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { getLedgerSummary, listTransactions } from "@/modules/ledger";
import type { ExpenseModule, TransactionType } from "@/modules/ledger/types";

function currentShanghaiMonth() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" }).formatToParts();
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

export default async function LedgerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const context = createActionContext(actor.userId, householdId);
  const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const month = one(params.month) || currentShanghaiMonth();
  const typeValue = one(params.type);
  const moduleValue = one(params.module);
  const query = one(params.query)?.trim();
  const cursor = one(params.cursor);
  const type = typeValue && typeValue !== "ALL" ? typeValue as TransactionType : undefined;
  const ledgerModule = moduleValue && moduleValue !== "ALL" ? moduleValue as ExpenseModule : undefined;
  const [summary, page] = await Promise.all([
    getLedgerSummary(context, month),
    listTransactions(context, { cursor, query, type, module: ledgerModule, limit: 20 }),
  ]);
  const nextParams = new URLSearchParams();
  if (query) nextParams.set("query", query);
  if (type) nextParams.set("type", type);
  if (ledgerModule) nextParams.set("module", ledgerModule);
  nextParams.set("month", month);
  if (page.nextCursor) nextParams.set("cursor", page.nextCursor);
  const cards = [
    { label: "收入", value: summary.income, icon: ArrowDownLeft, className: "text-emerald-700" },
    { label: "支出", value: summary.expense, icon: ArrowUpRight, className: "text-rose-700" },
    { label: "退款", value: summary.refunds, icon: RotateCcw, className: "text-amber-700" },
    { label: "净结余", value: summary.balance, icon: null, className: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-muted-foreground">家庭财务事实来源</p><h1 className="font-heading text-2xl font-semibold">家庭账本</h1></div>
        <Button asChild><Link href="/ledger/new"><Plus />新增账目</Link></Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <Card key={card.label} size="sm"><CardHeader><CardDescription>{card.label}</CardDescription><CardTitle className={`text-2xl ${card.className}`}>{formatCurrency(card.value)}</CardTitle></CardHeader></Card>)}
      </div>
      <Card>
        <CardHeader><CardTitle>账目明细</CardTitle><CardDescription>{month} · {summary.transactionCount} 笔；净支出 {formatCurrency(summary.netExpense)}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <LedgerFilters defaults={{ month, query, type, module: ledgerModule }} />
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead>日期</TableHead><TableHead>类型</TableHead><TableHead>商家 / 备注</TableHead><TableHead>用途</TableHead><TableHead className="text-right">金额</TableHead></TableRow></TableHeader>
              <TableBody>
                {page.items.length ? page.items.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap"><Link className="font-medium hover:underline" href={`/ledger/${transaction.id}`}>{new Date(transaction.occurredAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}</Link></TableCell>
                    <TableCell><Badge variant="outline">{transactionTypeLabels[transaction.type]}</Badge></TableCell>
                    <TableCell><p>{transaction.merchant ?? "—"}</p><p className="max-w-56 truncate text-xs text-muted-foreground">{transaction.note}</p></TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{[...new Set(transaction.allocations.map((item) => item.module))].map((item) => <Badge key={item} variant="secondary">{moduleLabels[item]}</Badge>)}</div></TableCell>
                    <TableCell className={`text-right font-medium ${transaction.type === "EXPENSE" ? "text-rose-700" : "text-emerald-700"}`}>{transaction.type === "EXPENSE" ? "−" : "+"}{formatCurrency(transaction.amount, transaction.currency)}</TableCell>
                  </TableRow>
                )) : <TableRow><TableCell className="h-28 text-center text-muted-foreground" colSpan={5}>当前筛选条件下还没有账目。</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          {page.nextCursor ? <div className="flex justify-end"><Button asChild variant="outline"><Link href={`/ledger?${nextParams.toString()}`}>下一页</Link></Button></div> : null}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>模块支出</CardTitle><CardDescription>退款已从对应模块扣减</CardDescription></CardHeader><CardContent className="space-y-3">{summary.byModule.length ? summary.byModule.map((item) => <div className="flex justify-between" key={item.module}><span>{moduleLabels[item.module]}</span><span className="font-medium">{formatCurrency(item.amount)}</span></div>) : <p className="text-sm text-muted-foreground">本月暂无支出。</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>分类支出</CardTitle><CardDescription>按净支出从高到低</CardDescription></CardHeader><CardContent className="space-y-3">{summary.byCategory.slice(0, 8).map((item) => <div className="flex justify-between" key={item.categoryId ?? item.name}><span>{item.name}</span><span className="font-medium">{formatCurrency(item.amount)}</span></div>)}</CardContent></Card>
      </div>
    </div>
  );
}

