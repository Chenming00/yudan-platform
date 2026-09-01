import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard description="我们会向已注册邮箱发送一次性重置链接。" title="找回密码">
      <div className="space-y-4">
        <ForgotPasswordForm />
        <p className="text-center text-sm">
          <Link className="text-primary hover:underline" href="/login">
            返回登录
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
