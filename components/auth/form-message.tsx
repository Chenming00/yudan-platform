import { AlertCircle, CircleCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AuthFormState } from "@/lib/auth/validation";

export function FormMessage({ state }: { state: AuthFormState }) {
  if (state.status === "idle" || !state.message) return null;
  const success = state.status === "success";
  const Icon = success ? CircleCheck : AlertCircle;

  return (
    <Alert variant={success ? "default" : "destructive"}>
      <Icon />
      <AlertTitle>{success ? "已完成" : "无法完成"}</AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
