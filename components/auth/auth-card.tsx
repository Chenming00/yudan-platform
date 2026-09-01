import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

export function AuthCard({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="w-full max-w-md">
      <Link className="mb-6 flex items-center justify-center gap-2" href="/login">
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
          鱼
        </span>
        <span>
          <span className="block font-heading text-base font-semibold">鱼蛋家庭</span>
          <span className="block text-xs text-muted-foreground">家庭开支与成长管理</span>
        </span>
      </Link>
      <Card>
        <CardHeader>
          <h1 className="font-heading text-xl leading-snug font-medium">{title}</h1>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        密码与会话由 Supabase Auth 安全管理
      </p>
    </div>
  );
}
