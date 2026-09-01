import { Baby, CalendarHeart, Ruler, Syringe } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { listBabies, listGrowth, listRecords, listVaccines } from "@/modules/care";

const recordLabels = { CHECKUP: "儿保", MEDICAL_VISIT: "就诊", MEDICATION: "用药", SUPPLEMENT: "保健品", OTHER: "其他" } as const;

export default async function CarePage() {
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const context = createActionContext(actor.userId, householdId);
  const [babies, growth, vaccines, records] = await Promise.all([listBabies(context), listGrowth(context), listVaccines(context), listRecords(context)]);
  return (
    <div className="space-y-6">
      <div><p className="text-sm text-muted-foreground">儿童健康档案</p><h1 className="font-heading text-2xl font-semibold">儿童保健</h1><p className="mt-1 text-sm text-muted-foreground">记录儿保、疫苗、医疗、药品和生长数据；付费项目通过账本 Allocation 关联。</p></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm"><CardHeader><CardDescription>宝宝资料</CardDescription><CardTitle className="flex items-center gap-2"><Baby className="size-5 text-primary" />{babies.length} 位</CardTitle></CardHeader></Card>
        <Card size="sm"><CardHeader><CardDescription>成长记录</CardDescription><CardTitle className="flex items-center gap-2"><Ruler className="size-5 text-primary" />{growth.length} 条</CardTitle></CardHeader></Card>
        <Card size="sm"><CardHeader><CardDescription>接种记录</CardDescription><CardTitle className="flex items-center gap-2"><Syringe className="size-5 text-primary" />{vaccines.length} 条</CardTitle></CardHeader></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card><CardHeader><CardTitle>宝宝资料</CardTitle></CardHeader><CardContent className="space-y-3">{babies.length ? babies.map((baby) => <div className="rounded-lg border p-3" key={baby.id}><p className="font-medium">{baby.name}</p><p className="text-sm text-muted-foreground">生日：{baby.birthday}{baby.sex ? ` · ${baby.sex}` : ""}</p></div>) : <p className="text-sm text-muted-foreground">还没有宝宝资料。</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>保健时间线</CardTitle><CardDescription>最新记录在前</CardDescription></CardHeader><CardContent className="divide-y">{records.length ? records.slice(0, 12).map((record) => <div className="flex gap-3 py-3 first:pt-0" key={record.id}><CalendarHeart className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{record.title}</p><Badge variant="outline">{recordLabels[record.type]}</Badge>{record.transactionAllocationId ? <Badge variant="secondary">已关联账本</Badge> : null}</div><p className="text-sm text-muted-foreground">{new Date(record.occurredAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}{record.provider ? ` · ${record.provider}` : ""}</p></div></div>) : <p className="py-3 text-sm text-muted-foreground">还没有保健记录。</p>}</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>最近生长与疫苗</CardTitle></CardHeader><CardContent className="grid gap-6 md:grid-cols-2"><div><h3 className="mb-3 text-sm font-medium">生长记录</h3>{growth.slice(0, 5).map((item) => <div className="flex justify-between border-b py-2 text-sm" key={item.id}><span>{item.measuredOn}</span><span>{item.weightKg} kg{item.heightCm ? ` · ${item.heightCm} cm` : ""}</span></div>)}{!growth.length ? <p className="text-sm text-muted-foreground">暂无数据。</p> : null}</div><div><h3 className="mb-3 text-sm font-medium">疫苗记录</h3>{vaccines.slice(0, 5).map((item) => <div className="flex justify-between border-b py-2 text-sm" key={item.id}><span>{item.vaccine}（{item.dose}）</span><span>{item.administeredOn}</span></div>)}{!vaccines.length ? <p className="text-sm text-muted-foreground">暂无数据。</p> : null}</div></CardContent></Card>
    </div>
  );
}

