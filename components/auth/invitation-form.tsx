"use client";

import { Copy, KeyRound } from "lucide-react";
import { useActionState, useState } from "react";

import {
  createInvitationAction,
  type AdminFormState,
} from "@/app/(platform)/admin/actions";
import { FieldError } from "@/components/auth/field-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InvitationForm({ householdId }: { householdId: string }) {
  const initialAdminFormState: AdminFormState = { status: "idle" };
  const [state, action, pending] = useActionState(
    createInvitationAction,
    initialAdminFormState,
  );
  const [copied, setCopied] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <input name="householdId" type="hidden" value={householdId} />
      {state.message ? (
        <Alert variant={state.status === "error" ? "destructive" : "default"}>
          <KeyRound />
          <AlertTitle>{state.status === "error" ? "创建失败" : "邀请码仅显示一次"}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.invitationCode ? (
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="break-all font-mono text-xs">{state.invitationCode}</p>
          <Button
            className="mt-3"
            onClick={async () => {
              await navigator.clipboard.writeText(state.invitationCode ?? "");
              setCopied(true);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <Copy /> {copied ? "已复制" : "复制邀请码"}
          </Button>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="roleCode">家庭角色</Label>
          <select
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            defaultValue="VIEWER"
            id="roleCode"
            name="roleCode"
          >
            <option value="VIEWER">查看者</option>
            <option value="EDITOR">编辑者</option>
            <option value="OWNER">所有者</option>
          </select>
          <FieldError errors={state.fieldErrors?.roleCode} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expiresInDays">有效天数</Label>
          <Input defaultValue="7" id="expiresInDays" max="30" min="1" name="expiresInDays" type="number" />
          <FieldError errors={state.fieldErrors?.expiresInDays} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">限定邮箱（可选）</Label>
        <Input id="email" name="email" placeholder="留空则任何持码人可注册" type="email" />
        <FieldError errors={state.fieldErrors?.email} />
      </div>
      <Button disabled={pending} type="submit">
        {pending ? "正在创建…" : "创建邀请码"}
      </Button>
    </form>
  );
}
