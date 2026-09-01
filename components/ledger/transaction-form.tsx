"use client";

import { CircleAlert, Plus, Trash2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import type { LedgerFormState } from "@/app/(platform)/ledger/actions";
import { moduleLabels } from "@/components/ledger/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  ExpenseModule,
  LedgerOptions,
  LedgerTransaction,
} from "@/modules/ledger/types";

type FormAction = (state: LedgerFormState, formData: FormData) => Promise<LedgerFormState>;
type AllocationDraft = { key: string; module: ExpenseModule; categoryId: string; amount: string; note: string };

const initialState: LedgerFormState = { status: "idle" };
const modules = Object.keys(moduleLabels) as ExpenseModule[];

function shanghaiLocalDateTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function moneyToCents(value: string) {
  const match = value.trim().match(/^(\d+)(?:\.(\d{0,2}))?$/);
  if (!match) return BigInt(0);
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
}

function centsToMoney(value: bigint) {
  return `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`;
}

function newAllocation(module: ExpenseModule = "OTHER"): AllocationDraft {
  return { key: crypto.randomUUID(), module, categoryId: "", amount: "", note: "" };
}

export function TransactionForm({
  action,
  options,
  initial,
  mode = "transaction",
}: {
  action: FormAction;
  options: LedgerOptions;
  initial?: LedgerTransaction;
  mode?: "transaction" | "refund";
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [allocations, setAllocations] = useState<AllocationDraft[]>(() =>
    initial?.allocations.length
      ? initial.allocations.map((item) => ({
          key: item.id,
          module: item.module,
          categoryId: item.category?.id ?? "",
          amount: item.amount,
          note: item.note ?? "",
        }))
      : [newAllocation()],
  );
  const total = useMemo(
    () => centsToMoney(allocations.reduce((sum, item) => sum + moneyToCents(item.amount), BigInt(0))),
    [allocations],
  );
  const updateAllocation = (index: number, patch: Partial<AllocationDraft>) => {
    setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  return (
    <form action={formAction} className="space-y-6">
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <input name="amount" type="hidden" value={total} />
      <input name="allocationCount" type="hidden" value={allocations.length} />

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>无法保存</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {mode === "transaction" ? (
        <div className="grid gap-2 sm:max-w-xs">
          <Label>账目类型</Label>
          <Select defaultValue={initial?.type ?? "EXPENSE"} name="type">
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EXPENSE">支出</SelectItem>
              <SelectItem value="INCOME">收入</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="occurredAt">发生时间</Label>
          <Input defaultValue={shanghaiLocalDateTime(mode === "refund" ? undefined : initial?.occurredAt)} id="occurredAt" name="occurredAt" required type="datetime-local" />
        </div>
        {mode === "transaction" ? (
          <div className="grid gap-2">
            <Label>支付账户</Label>
            <Select defaultValue={initial?.paymentAccount?.id ?? options.paymentAccounts[0]?.id} name="paymentAccountId">
              <SelectTrigger className="w-full"><SelectValue placeholder="暂不指定" /></SelectTrigger>
              <SelectContent>
                {options.paymentAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {mode === "transaction" ? (
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="merchant">商家 / 收款方</Label>
            <Input defaultValue={initial?.merchant ?? ""} id="merchant" name="merchant" placeholder="例如：儿童医院、超市" />
          </div>
        ) : null}
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="note">备注</Label>
          <Textarea defaultValue={initial?.note ?? ""} id="note" name="note" placeholder={mode === "refund" ? "退款原因" : "可选说明"} />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-heading font-medium">用途拆分</h2>
            <p className="text-sm text-muted-foreground">一笔付款可以拆到多个模块，合计会自动作为账目金额。</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">合计</p>
            <p className="font-heading text-xl font-semibold">¥{total}</p>
          </div>
        </div>

        <div className="space-y-3">
          {allocations.map((allocation, index) => {
            const matchingCategories = options.categories.filter((category) => category.module === allocation.module);
            return (
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 lg:grid-cols-[1fr_1fr_8rem_1fr_auto]" key={allocation.key}>
                <input name={`allocations.${index}.module`} type="hidden" value={allocation.module} />
                <input name={`allocations.${index}.categoryId`} type="hidden" value={allocation.categoryId} />
                <div className="grid gap-2">
                  <Label>模块</Label>
                  <Select value={allocation.module} onValueChange={(value) => updateAllocation(index, { module: value as ExpenseModule, categoryId: "" })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{modules.map((module) => <SelectItem key={module} value={module}>{moduleLabels[module]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>分类</Label>
                  <Select value={allocation.categoryId || undefined} onValueChange={(value) => updateAllocation(index, { categoryId: value })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="未分类" /></SelectTrigger>
                    <SelectContent>{matchingCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`allocation-${index}-amount`}>金额</Label>
                  <Input id={`allocation-${index}-amount`} inputMode="decimal" min="0.01" name={`allocations.${index}.amount`} onChange={(event) => updateAllocation(index, { amount: event.target.value })} placeholder="0.00" required step="0.01" type="number" value={allocation.amount} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`allocation-${index}-note`}>说明</Label>
                  <Input id={`allocation-${index}-note`} name={`allocations.${index}.note`} onChange={(event) => updateAllocation(index, { note: event.target.value })} placeholder="可选" value={allocation.note} />
                </div>
                <Button aria-label="删除拆分" className="self-end" disabled={allocations.length === 1} onClick={() => setAllocations((current) => current.filter((_, itemIndex) => itemIndex !== index))} size="icon" type="button" variant="ghost"><Trash2 /></Button>
              </div>
            );
          })}
        </div>
        <Button onClick={() => setAllocations((current) => [...current, newAllocation()])} type="button" variant="outline"><Plus />添加拆分</Button>
      </section>

      <div className="flex gap-3 border-t pt-5">
        <Button disabled={pending || total === "0.00"} size="lg" type="submit">{pending ? "保存中…" : mode === "refund" ? "确认退款" : initial ? "保存修改" : "保存账目"}</Button>
        <Button asChild size="lg" variant="outline"><a href={initial ? `/ledger/${initial.id}` : "/ledger"}>取消</a></Button>
      </div>
    </form>
  );
}
