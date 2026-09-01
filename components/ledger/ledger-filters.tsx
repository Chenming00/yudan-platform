"use client";

import { Search } from "lucide-react";

import { moduleLabels } from "@/components/ledger/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LedgerFilters({ defaults }: { defaults: { query?: string; type?: string; module?: string; month: string } }) {
  return (
    <form className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_10rem_10rem_10rem_auto]" method="get">
      <div className="relative"><Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" /><Input className="pl-8" defaultValue={defaults.query} name="query" placeholder="搜索商家或备注" /></div>
      <Select defaultValue={defaults.type ?? "ALL"} name="type"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">全部类型</SelectItem><SelectItem value="EXPENSE">支出</SelectItem><SelectItem value="INCOME">收入</SelectItem><SelectItem value="REFUND">退款</SelectItem></SelectContent></Select>
      <Select defaultValue={defaults.module ?? "ALL"} name="module"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">全部模块</SelectItem>{Object.entries(moduleLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
      <Input defaultValue={defaults.month} name="month" type="month" />
      <Button type="submit">筛选</Button>
    </form>
  );
}
