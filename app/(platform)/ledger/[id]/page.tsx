import { ArrowLeft, Pencil, RotateCcw } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteTransactionButton } from "@/components/ledger/delete-transaction-button";
import { formatCurrency, moduleLabels, transactionTypeLabels } from "@/components/ledger/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { getTransaction } from "@/modules/ledger";

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const transaction = await getTransaction(createActionContext(actor.userId, householdId), id);
  if (!transaction) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild size="sm" variant="ghost"><Link href="/ledger"><ArrowLeft />返回账本</Link></Button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-2 flex items-center gap-2"><Badge variant="outline">{transactionTypeLabels[transaction.type]}</Badge>{transaction.refundOfTransactionId ? <Badge variant="secondary">关联原支出</Badge> : null}</div><h1 className="font-heading text-3xl font-semibold">{formatCurrency(transaction.amount, transaction.currency)}</h1><p className="text-sm text-muted-foreground">{new Date(transaction.occurredAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p></div>
        <div className="flex flex-wrap gap-2">
          {transaction.type !== "REFUND" ? <Button asChild variant="outline"><Link href={`/ledger/${transaction.id}/edit`}><Pencil />编辑</Link></Button> : null}
          {transaction.type === "EXPENSE" ? <Button asChild><Link href={`/ledger/${transaction.id}/refund`}><RotateCcw />登记退款</Link></Button> : null}
          <DeleteTransactionButton transactionId={transaction.id} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm"><CardHeader><CardDescription>商家 / 收款方</CardDescription><CardTitle>{transaction.merchant ?? "未填写"}</CardTitle></CardHeader></Card>
        <Card size="sm"><CardHeader><CardDescription>支付账户</CardDescription><CardTitle>{transaction.paymentAccount?.name ?? "未指定"}</CardTitle></CardHeader></Card>
        <Card size="sm"><CardHeader><CardDescription>备注</CardDescription><CardTitle>{transaction.note ?? "无"}</CardTitle></CardHeader></Card>
      </div>
      {transaction.refundOfTransactionId ? <Card size="sm"><CardContent><Link className="text-sm font-medium text-primary hover:underline" href={`/ledger/${transaction.refundOfTransactionId}`}>查看这笔退款对应的原支出</Link></CardContent></Card> : null}
      <Card><CardHeader><CardTitle>用途拆分</CardTitle><CardDescription>拆分合计与账目金额严格一致</CardDescription></CardHeader><CardContent className="divide-y">{transaction.allocations.map((allocation) => <div className="flex flex-col gap-1 py-4 first:pt-0 sm:flex-row sm:items-center" key={allocation.id}><div className="flex-1"><p className="font-medium">{moduleLabels[allocation.module]} · {allocation.category?.name ?? "未分类"}</p><p className="text-sm text-muted-foreground">{allocation.note ?? "无说明"}</p></div><p className="font-medium">{formatCurrency(allocation.amount, transaction.currency)}</p></div>)}</CardContent></Card>
    </div>
  );
}
