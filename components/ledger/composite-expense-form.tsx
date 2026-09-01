"use client";

import { CircleAlert, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { createCompositeExpenseAction, type CompositeExpenseFormState } from "@/app/(platform)/ledger/new/composite/actions";
import { moduleLabels } from "@/components/ledger/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductView } from "@/modules/consumables/types";
import type { ExpenseModule, LedgerOptions } from "@/modules/ledger/types";

type Row = { key: string; module: ExpenseModule; categoryId: string; amount: string };
type BabyOption = { id: string; name: string };
type ProductOption = Pick<ProductView, "productCode" | "name" | "unit" | "currentStock">;
const initial: CompositeExpenseFormState = { status: "idle" };
const modules = Object.keys(moduleLabels) as ExpenseModule[];
const careTypes = { CHECKUP: "儿童保健", MEDICAL_VISIT: "就医", MEDICATION: "用药", SUPPLEMENT: "补充剂", OTHER: "其他" } as const;

function localNow() { const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000); return date.toISOString().slice(0, 16); }
function cents(value: string) { const match = value.match(/^(\d+)(?:\.(\d{0,2}))?$/); return match ? BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0")) : BigInt(0); }
function money(value: bigint) { return `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`; }
function newRow(module: ExpenseModule = "OTHER"): Row { return { key: crypto.randomUUID(), module, categoryId: "", amount: "" }; }

export function CompositeExpenseForm({ options, babies, products }: { options: LedgerOptions; babies: BabyOption[]; products: ProductOption[] }) {
  const [state, action, pending] = useActionState(createCompositeExpenseAction, initial);
  const [rows, setRows] = useState<Row[]>(() => [newRow("CONSUMABLES"), newRow("WARDROBE"), newRow("CHILD_CARE")]);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const total = useMemo(() => money(rows.reduce((sum, row) => sum + cents(row.amount), BigInt(0))), [rows]);
  const update = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));

  return <form action={action} className="space-y-6">
    <input name="amount" type="hidden" value={total} /><input name="allocationCount" type="hidden" value={rows.length} /><input name="idempotencyKey" type="hidden" value={idempotencyKey} />
    {state.status === "error" ? <Alert variant="destructive"><CircleAlert /><AlertTitle>整笔付款未保存</AlertTitle><AlertDescription>{state.message}</AlertDescription></Alert> : null}
    <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="composite-occurred">付款时间</Label><Input defaultValue={localNow()} id="composite-occurred" name="occurredAt" required type="datetime-local" /></div><div className="grid gap-2"><Label>支付账户</Label><Select defaultValue={options.paymentAccounts[0]?.id} name="paymentAccountId"><SelectTrigger className="w-full"><SelectValue placeholder="暂不指定" /></SelectTrigger><SelectContent>{options.paymentAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="composite-merchant">商家</Label><Input id="composite-merchant" name="merchant" placeholder="例如：京东" /></div><div className="grid gap-2"><Label htmlFor="composite-note">付款备注</Label><Input id="composite-note" name="note" /></div></div>
    <section className="space-y-4"><div className="flex items-end justify-between gap-4"><div><h2 className="font-heading font-medium">用途与业务明细</h2><p className="text-sm text-muted-foreground">每个用途会同时生成对应模块记录，任何一项失败都不会保存。</p></div><div className="text-right"><p className="text-xs text-muted-foreground">付款合计</p><p className="font-mono text-2xl font-semibold">¥{total}</p></div></div>
      {rows.map((row, index) => { const categories = options.categories.filter((category) => category.module === row.module); return <div className="space-y-4 rounded-xl border bg-muted/20 p-4" key={row.key}><input name={`allocations.${index}.module`} type="hidden" value={row.module} /><input name={`allocations.${index}.categoryId`} type="hidden" value={row.categoryId} /><div className="grid gap-3 md:grid-cols-[1fr_1fr_9rem_auto]"><div className="grid gap-2"><Label>用途</Label><Select value={row.module} onValueChange={(value) => update(index, { module: value as ExpenseModule, categoryId: "" })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{modules.map((module) => <SelectItem key={module} value={module}>{moduleLabels[module]}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>分类</Label><Select value={row.categoryId || undefined} onValueChange={(value) => update(index, { categoryId: value })}><SelectTrigger className="w-full"><SelectValue placeholder="未分类" /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor={`composite-${index}-amount`}>金额</Label><Input id={`composite-${index}-amount`} min="0.01" name={`allocations.${index}.amount`} onChange={(event) => update(index, { amount: event.target.value })} required step="0.01" type="number" value={row.amount} /></div><Button aria-label="删除用途" className="self-end" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} size="icon" type="button" variant="ghost"><Trash2 /></Button></div>
        <div className="grid gap-2"><Label htmlFor={`composite-${index}-note`}>用途说明</Label><Input id={`composite-${index}-note`} name={`allocations.${index}.note`} /></div>
        {row.module === "CHILD_CARE" ? <div className="grid gap-3 border-t pt-4 sm:grid-cols-2"><div className="grid gap-2"><Label>宝宝</Label><Select name={`allocations.${index}.care.babyProfileId`} required><SelectTrigger className="w-full"><SelectValue placeholder="选择宝宝" /></SelectTrigger><SelectContent>{babies.map((baby) => <SelectItem key={baby.id} value={baby.id}>{baby.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>记录类型</Label><Select defaultValue="CHECKUP" name={`allocations.${index}.care.type`}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(careTypes).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>项目</Label><Input name={`allocations.${index}.care.title`} placeholder="例如：一岁儿童保健" required /></div><div className="grid gap-2"><Label>机构</Label><Input name={`allocations.${index}.care.provider`} /></div></div> : null}
        {row.module === "WARDROBE" ? <div className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4"><div className="grid gap-2"><Label>衣物名称</Label><Input name={`allocations.${index}.wardrobe.name`} required /></div><div className="grid gap-2"><Label>品类</Label><Input name={`allocations.${index}.wardrobe.category`} /></div><div className="grid gap-2"><Label>尺码</Label><Input name={`allocations.${index}.wardrobe.size`} /></div><div className="grid gap-2"><Label>数量</Label><Input defaultValue="1" min="1" name={`allocations.${index}.wardrobe.quantity`} required type="number" /></div></div> : null}
        {row.module === "CONSUMABLES" ? <div className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4"><div className="grid gap-2"><Label>产品</Label><Select name={`allocations.${index}.consumables.productCode`} required><SelectTrigger className="w-full"><SelectValue placeholder="选择产品" /></SelectTrigger><SelectContent>{products.map((product) => <SelectItem key={product.productCode} value={product.productCode}>{product.name}（{product.currentStock} {product.unit}）</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>数量</Label><Input defaultValue="1" min="1" name={`allocations.${index}.consumables.quantity`} required type="number" /></div><div className="grid gap-2"><Label>到期日</Label><Input name={`allocations.${index}.consumables.expiresOn`} type="date" /></div><div className="grid gap-2"><Label>存放位置</Label><Input name={`allocations.${index}.consumables.storageLocation`} /></div></div> : null}
      </div>; })}
      <Button onClick={() => setRows((current) => [...current, newRow()])} type="button" variant="outline"><Plus />添加用途</Button>
    </section>
    <div className="flex flex-wrap gap-3 border-t pt-5"><Button disabled={pending || total === "0.00"} size="lg" type="submit">{pending ? "原子保存中…" : `保存付款 ¥${total}`}</Button><Button asChild size="lg" variant="outline"><Link href="/ledger">取消</Link></Button></div>
  </form>;
}
