import { notFound } from "next/navigation";

import { createRefundAction } from "@/app/(platform)/ledger/actions";
import { formatCurrency } from "@/components/ledger/labels";
import { TransactionForm } from "@/components/ledger/transaction-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { getLedgerOptions, getTransaction } from "@/modules/ledger";

export default async function RefundTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const context = createActionContext(actor.userId, householdId);
  const [transaction, options] = await Promise.all([getTransaction(context, id), getLedgerOptions(context)]);
  if (!transaction || transaction.type !== "EXPENSE") notFound();
  const action = createRefundAction.bind(null, transaction.id);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div><p className="text-sm text-muted-foreground">家庭账本</p><h1 className="font-heading text-2xl font-semibold">登记退款</h1></div>
      <Alert><AlertTitle>原支出 {formatCurrency(transaction.amount, transaction.currency)}</AlertTitle><AlertDescription>退款作为独立记录保留，并从原用途的净支出中扣减；可修改各拆分金额完成部分退款。</AlertDescription></Alert>
      <Card><CardHeader><CardTitle>退款金额与用途</CardTitle><CardDescription>退款不能超过原支出及其各用途的剩余可退金额。</CardDescription></CardHeader><CardContent><TransactionForm action={action} initial={transaction} mode="refund" options={options} /></CardContent></Card>
    </div>
  );
}
