import type { LucideIcon } from "lucide-react";
import { ArrowRight, CircleDashed } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  primaryAction: string;
  features: string[];
}

export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  primaryAction,
  features,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="mb-3" variant="secondary">
            模块骨架
          </Badge>
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <Button disabled>
          {primaryAction}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature}>
            <CardHeader>
              <div className="mb-2 grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <Icon className="size-4" />
              </div>
              <CardTitle>{feature}</CardTitle>
              <CardDescription>对应 Agent 接入数据库与权限后启用。</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
          <CircleDashed className="mb-4 size-8 text-muted-foreground" />
          <h2 className="font-heading text-base font-medium">这里还没有数据</h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            当前完成的是共享界面与模块边界。业务实现将按开发任务计划逐步接入。
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/">返回家庭总览</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

