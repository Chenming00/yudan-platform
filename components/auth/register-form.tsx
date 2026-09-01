"use client";

import { useActionState } from "react";

import { registerAction } from "@/app/(auth)/actions";
import { FieldError } from "@/components/auth/field-error";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialAuthFormState } from "@/lib/auth/validation";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialAuthFormState);

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="displayName">显示名称</Label>
        <Input autoComplete="name" id="displayName" name="displayName" required />
        <FieldError errors={state.fieldErrors?.displayName} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">邮箱</Label>
        <Input autoComplete="email" id="email" name="email" required type="email" />
        <FieldError errors={state.fieldErrors?.email} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="password">密码</Label>
          <Input autoComplete="new-password" id="password" name="password" required type="password" />
          <FieldError errors={state.fieldErrors?.password} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">确认密码</Label>
          <Input
            autoComplete="new-password"
            id="confirmPassword"
            name="confirmPassword"
            required
            type="password"
          />
          <FieldError errors={state.fieldErrors?.confirmPassword} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invitationCode">邀请码</Label>
        <Input
          autoCapitalize="none"
          autoComplete="off"
          id="invitationCode"
          name="invitationCode"
          placeholder="由家庭管理员提供"
          required
        />
        <FieldError errors={state.fieldErrors?.invitationCode} />
      </div>
      <Button className="w-full" disabled={pending} size="lg" type="submit">
        {pending ? "正在创建账号…" : "使用邀请码注册"}
      </Button>
    </form>
  );
}
