import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthCard description="注册需要家庭管理员发放的有效邀请码，不强制绑定 GitHub。" title="创建账号">
      <div className="space-y-4">
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          已有账号？{" "}
          <Link className="font-medium text-primary hover:underline" href="/login">
            返回登录
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
