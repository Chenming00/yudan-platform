import { Github, KeyRound, Settings, Users } from "lucide-react";
import Link from "next/link";

import { linkGithubIdentityAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Settings className="size-5" /></div>
        <div><p className="text-sm text-muted-foreground">平台管理</p><h1 className="font-heading text-2xl font-semibold">系统设置</h1></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-4" />家庭成员</CardTitle><CardDescription>管理成员角色和家庭内的数据权限。</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link href="/admin/users">管理成员</Link></Button></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-4" />邀请码</CardTitle><CardDescription>创建一次性注册入口，邀请码明文只显示一次。</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link href="/admin/invitations">管理邀请码</Link></Button></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Github className="size-4" />GitHub 身份</CardTitle><CardDescription>可选绑定，不影响邮箱密码登录，也不是注册条件。</CardDescription></CardHeader><CardContent><form action={linkGithubIdentityAction}><Button type="submit" variant="outline"><Github />绑定 GitHub</Button></form></CardContent></Card>
      </div>
    </div>
  );
}

