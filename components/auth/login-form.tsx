"use client";

import { useActionState } from "react";

import { FieldError } from "@/components/auth/field-error";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/app/(auth)/actions";
import { initialAuthFormState } from "@/lib/auth/validation";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, initialAuthFormState);

  return (
    <form action={action} className="space-y-4">
      <input name="next" type="hidden" value={next} />
      <FormMessage state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="email">邮箱</Label>
        <Input
          autoComplete="email"
          id="email"
          name="email"
          placeholder="name@example.com"
          required
          type="email"
        />
        <FieldError errors={state.fieldErrors?.email} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">密码</Label>
          <a className="text-xs text-primary hover:underline" href="/forgot-password">
            忘记密码？
          </a>
        </div>
        <Input
          autoComplete="current-password"
          id="password"
          name="password"
          required
          type="password"
        />
        <FieldError errors={state.fieldErrors?.password} />
      </div>
      <Button className="w-full" disabled={pending} size="lg" type="submit">
        {pending ? "正在登录…" : "登录"}
      </Button>
    </form>
  );
}
