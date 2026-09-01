import { Github } from "lucide-react";
import Link from "next/link";

import { githubSignInAction } from "@/app/(auth)/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard description="使用邮箱和密码进入家庭空间。" title="欢迎回来">
      <div className="space-y-4">
        {params.error ? (
          <Alert variant="destructive">
            <AlertDescription>{params.error}</AlertDescription>
          </Alert>
        ) : null}
        <LoginForm next={getSafeRedirectPath(params.next, "/")} />
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">可选方式</span>
          <Separator className="flex-1" />
        </div>
        <form action={githubSignInAction}>
          <Button className="w-full" type="submit" variant="outline">
            <Github /> 使用已绑定的 GitHub 登录
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <Link className="font-medium text-primary hover:underline" href="/register">
            使用邀请码注册
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
