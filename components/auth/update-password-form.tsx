"use client";

import { useActionState } from "react";

import { updatePasswordAction } from "@/app/(auth)/actions";
import { FieldError } from "@/components/auth/field-error";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialAuthFormState } from "@/lib/auth/validation";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(
    updatePasswordAction,
    initialAuthFormState,
  );
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="password">新密码</Label>
        <Input autoComplete="new-password" id="password" name="password" required type="password" />
        <FieldError errors={state.fieldErrors?.password} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">确认新密码</Label>
        <Input
          autoComplete="new-password"
          id="confirmPassword"
          name="confirmPassword"
          required
          type="password"
        />
        <FieldError errors={state.fieldErrors?.confirmPassword} />
      </div>
      <Button className="w-full" disabled={pending} size="lg" type="submit">
        {pending ? "正在更新…" : "更新密码"}
      </Button>
    </form>
  );
}
