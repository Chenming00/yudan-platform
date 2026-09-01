import {
  ArrowRight,
  Baby,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  Plus,
  ReceiptText,
  Shirt,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const summaries = [
  { label: "本月总支出", value: "¥0.00", icon: CircleDollarSign },
  { label: "儿童保健", value: "¥0.00", icon: Baby },
  { label: "衣柜", value: "¥0.00", icon: Shirt },
  { label: "消耗品", value: "¥0.00", icon: Boxes },
];

const businessModules = [
  {
    title: "儿童保健",
    description: "儿保、疫苗、医疗和成长记录",
    href: "/care",
    icon: Baby,
    accent: "bg-chart-2/15 text-chart-2",
  },
  {
    title: "衣柜",
    description: "衣物状态、尺码与购衣开支",
    href: "/wardrobe",
    icon: Shirt,
    accent: "bg-chart-4/15 text-chart-4",
  },
  {
    title: "消耗品",
    description: "当前库存、采购和补货提醒",
    href: "/consumables",
    icon: Boxes,
    accent: "bg-chart-1/15 text-chart-1",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="secondary">家庭空间</Badge>
            <span className="text-xs text-muted-foreground">数据接入准备中</span>
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">家庭总览</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            所有保健、衣柜和消耗品开支，最终都回到同一本账。
          </p>
        </div>
        <Button asChild>
          <Link href="/ledger/new">
            <Plus data-icon="inline-start" />
            新增账目
          </Link>
        </Button>
      </section>

      <section aria-label="本月开支摘要" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map(({ label, value, icon: Icon }) => (
          <Card size="sm" key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardAction>
                <Icon className="size-4 text-muted-foreground" />
              </CardAction>
              <CardTitle className="font-mono text-2xl tabular-nums">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>业务模块</CardTitle>
            <CardDescription>业务记录解释开支，账本负责保存钱的事实。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {businessModules.map(({ title, description, href, icon: Icon, accent }) => (
              <Link
                className="group rounded-xl border p-4 transition-colors hover:bg-accent/50"
                href={href}
                key={title}
              >
                <div className={`mb-5 grid size-10 place-items-center rounded-lg ${accent}`}>
                  <Icon className="size-5" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-heading font-medium">{title}</h2>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>近期提醒</CardTitle>
            <CardDescription>疫苗、尺码、低库存和临期信息。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
              <CalendarClock className="mb-3 size-7 text-muted-foreground" />
              <p className="text-sm font-medium">暂时没有提醒</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">模块数据接入后会自动汇总。</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <Badge className="mb-2 w-fit" variant="outline">
            <Sparkles className="size-3" />
            关联设计示例
          </Badge>
          <CardTitle>一笔付款，多种用途，只统计一次</CardTitle>
          <CardDescription>京东付款 ¥520 可以同时关联三个业务模块。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="rounded-xl bg-muted p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-lg bg-background">
                  <ReceiptText className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">账本付款</p>
                  <p className="font-mono text-xs text-muted-foreground">¥520.00 · 京东</p>
                </div>
              </div>
            </div>
            <ArrowRight className="mx-auto size-4 rotate-90 text-muted-foreground md:rotate-0" />
            <div className="space-y-2 rounded-xl border p-4 text-sm">
              <div className="flex justify-between"><span>消耗品</span><span className="font-mono">¥300</span></div>
              <Separator />
              <div className="flex justify-between"><span>衣柜</span><span className="font-mono">¥150</span></div>
              <Separator />
              <div className="flex justify-between"><span>儿童保健</span><span className="font-mono">¥70</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

