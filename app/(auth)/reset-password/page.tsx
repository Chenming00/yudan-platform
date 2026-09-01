import { AuthCard } from "@/components/auth/auth-card";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthCard description="设置一个至少 8 位的新密码。" title="更新密码">
      <UpdatePasswordForm />
    </AuthCard>
  );
}
