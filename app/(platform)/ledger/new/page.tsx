import { TransactionForm } from "@/components/ledger/transaction-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Layers3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { getLedgerOptions } from "@/modules/ledger";

import { createTransactionAction } from "../actions";

export default async function NewLedgerEntryPage() {
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const options = await getLedgerOptions(createActionContext(actor.userId, householdId));
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">家庭账本</p><h1 className="font-heading text-2xl font-semibold">新增账目</h1></div><Button asChild variant="outline"><Link href="/ledger/new/composite"><Layers3 />切换到组合记账</Link></Button></div>
      <Card><CardHeader><CardTitle>付款与用途</CardTitle><CardDescription>账目总额由用途拆分自动汇总，避免重复统计。</CardDescription></CardHeader><CardContent><TransactionForm action={createTransactionAction} options={options} /></CardContent></Card>
    </div>
  );
}

