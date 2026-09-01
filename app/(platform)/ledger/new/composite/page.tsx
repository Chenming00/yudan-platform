import { Layers3 } from "lucide-react";

import { CompositeExpenseForm } from "@/components/ledger/composite-expense-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { listBabies } from "@/modules/care";
import { listProducts } from "@/modules/consumables";
import { getLedgerOptions } from "@/modules/ledger";

export default async function CompositeExpensePage() {
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const context = createActionContext(actor.userId, householdId);
  const [options, babies, products] = await Promise.all([getLedgerOptions(context), listBabies(context), listProducts(context)]);
  return <div className="mx-auto max-w-6xl space-y-6"><div><p className="text-sm text-muted-foreground">家庭账本</p><h1 className="flex items-center gap-2 font-heading text-2xl font-semibold"><Layers3 className="size-6" />组合记账</h1><p className="mt-1 text-sm text-muted-foreground">一次付款拆到多个模块，账本只统计一次，业务记录与库存同步生成。</p></div><Card><CardHeader><CardTitle>付款与业务明细</CardTitle><CardDescription>整张表单在一个数据库事务中保存。</CardDescription></CardHeader><CardContent><CompositeExpenseForm babies={babies.map(({ id, name }) => ({ id, name }))} options={options} products={products.map(({ productCode, name, unit, currentStock }) => ({ productCode, name, unit, currentStock }))} /></CardContent></Card></div>;
}
