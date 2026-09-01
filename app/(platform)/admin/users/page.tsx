import { setPlatformUserStatusAction, updateHouseholdMemberAction } from "@/app/(platform)/admin/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createActionContext } from "@/lib/auth/authorization";
import { requirePlatformActor } from "@/lib/auth/session";
import { listHouseholdMembers } from "@/modules/auth";

export default async function UsersPage() {
  const actor = await requirePlatformActor();
  const householdId = actor.householdIds[0];
  if (!householdId) return <p>尚未加入家庭空间。</p>;
  const members = await listHouseholdMembers(createActionContext(actor.userId, householdId));

  return (
    <div className="space-y-6">
      <div><p className="text-sm text-muted-foreground">账户与权限</p><h1 className="font-heading text-2xl font-semibold">家庭成员</h1></div>
      <Card>
        <CardHeader><CardTitle>成员与角色</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div className="rounded-lg border p-3" key={member.userId}>
              <form action={updateHouseholdMemberAction} className="grid gap-3 md:grid-cols-[1fr_160px_150px_auto] md:items-center">
                <input name="householdId" type="hidden" value={householdId} />
                <input name="userId" type="hidden" value={member.userId} />
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar><AvatarFallback>{(member.user.displayName ?? member.user.emailNormalized).slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{member.user.displayName ?? "未设置名称"}</p><p className="truncate text-xs text-muted-foreground">{member.user.emailNormalized}</p></div>
                </div>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" defaultValue={member.role.code} name="roleCode">
                  <option value="VIEWER">查看者</option><option value="EDITOR">编辑者</option><option value="OWNER">所有者</option>
                </select>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" defaultValue={member.status} name="status">
                  <option value="ACTIVE">有效</option><option value="SUSPENDED">暂停</option><option value="LEFT">已离开</option>
                </select>
                <div className="flex items-center gap-2"><Badge variant="outline">{member.user.status}</Badge><Button size="sm" type="submit">保存</Button></div>
              </form>
              {actor.isSuperAdmin ? (
                <form action={setPlatformUserStatusAction} className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
                  <input name="householdId" type="hidden" value={householdId} /><input name="userId" type="hidden" value={member.userId} />
                  <span className="text-xs text-muted-foreground">平台账号</span>
                  <select className="h-7 rounded-lg border bg-background px-2 text-xs" defaultValue={member.user.status === "PENDING_VERIFICATION" ? "ACTIVE" : member.user.status} name="status"><option value="ACTIVE">启用</option><option value="SUSPENDED">暂停</option><option value="DISABLED">停用</option></select>
                  <Button size="sm" type="submit" variant="outline">更新账号</Button>
                </form>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
