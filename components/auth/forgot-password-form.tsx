"use client";

import { useActionState } from "react";

import { forgotPasswordAction } from "@/app/(auth)/actions";
import { FieldError } from "@/components/auth/field-error";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialAuthFormState } from "@/lib/auth/validation";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    forgotPasswordAction,
    initialAuthFormState,
  );
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="email">邮箱</Label>
        <Input autoComplete="email" id="email" name="email" required type="email" />
        <FieldError errors={state.fieldErrors?.email} />
      </div>
      <Button className="w-full" disabled={pending} size="lg" type="submit">
        {pending ? "正在发送…" : "发送重置邮件"}
      </Button>
    </form>
  );
}
