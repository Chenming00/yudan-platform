import { Ban, KeyRound } from "lucide-react";

import { revokeInvitationAction } from "@/app/(platform)/admin/actions";
import { InvitationForm } from "@/components/auth/invitation-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { listInvitations } from "@/modules/auth";

export default async function InvitationsPage() {
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const invitations = await listInvitations(createActionContext(actor.userId, householdId));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">账户与权限</p>
        <h1 className="font-heading text-2xl font-semibold">邀请码</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>创建邀请</CardTitle></CardHeader>
        <CardContent><InvitationForm householdId={householdId} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>邀请记录</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {invitations.length ? invitations.map((invitation) => (
              <div className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center" key={invitation.id}>
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><KeyRound className="size-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invitation.emailNormalized ?? "不限邮箱"}</p>
                  <p className="text-xs text-muted-foreground">{invitation.role.name} · 到期 {invitation.expiresAt.toLocaleDateString("zh-CN")}</p>
                </div>
                <Badge variant="outline">{invitation.status}</Badge>
                {invitation.status === "ACTIVE" ? (
                  <form action={revokeInvitationAction}>
                    <input name="householdId" type="hidden" value={householdId} />
                    <input name="invitationId" type="hidden" value={invitation.id} />
                    <Button size="sm" type="submit" variant="destructive"><Ban />撤销</Button>
                  </form>
                ) : null}
              </div>
            )) : <p className="py-6 text-center text-sm text-muted-foreground">还没有邀请记录。</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
