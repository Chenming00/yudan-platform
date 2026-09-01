import { notFound } from "next/navigation";

import { updateTransactionAction } from "@/app/(platform)/ledger/actions";
import { TransactionForm } from "@/components/ledger/transaction-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { getLedgerOptions, getTransaction } from "@/modules/ledger";

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const context = createActionContext(actor.userId, householdId);
  const [transaction, options] = await Promise.all([getTransaction(context, id), getLedgerOptions(context)]);
  if (!transaction || transaction.type === "REFUND") notFound();
  const action = updateTransactionAction.bind(null, transaction.id);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div><p className="text-sm text-muted-foreground">家庭账本</p><h1 className="font-heading text-2xl font-semibold">编辑账目</h1></div>
      <Card><CardHeader><CardTitle>付款与用途</CardTitle><CardDescription>有退款的原账目会被锁定，保护财务追溯关系。</CardDescription></CardHeader><CardContent><TransactionForm action={action} initial={transaction} options={options} /></CardContent></Card>
    </div>
  );
}
