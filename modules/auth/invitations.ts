import "server-only";

import type { ActionContext } from "@/lib/types/platform";
import { writeAuditLog } from "@/lib/auth/audit";
import { authorize } from "@/lib/auth/authorization";
import { AuthError } from "@/lib/auth/errors";
import { createOpaqueToken, hashOpaqueToken, normalizeEmail } from "@/lib/auth/tokens";
import { getDatabase } from "@/lib/db/client";

const registrationIntentLifetimeMs = 10 * 60 * 1_000;

export async function createRegistrationIntent(input: {
  invitationCode: string;
  email: string;
}) {
  const invitationHash = hashOpaqueToken(input.invitationCode.trim());
  const emailNormalized = normalizeEmail(input.email);
  const intentToken = createOpaqueToken();
  const intentTokenHash = hashOpaqueToken(intentToken);
  const expiresAt = new Date(Date.now() + registrationIntentLifetimeMs);
  const db = getDatabase();

  const result = await db.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { tokenHash: invitationHash },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        emailNormalized: true,
      },
    });

    if (
      !invitation ||
      invitation.status !== "ACTIVE" ||
      invitation.expiresAt <= new Date() ||
      (invitation.emailNormalized && invitation.emailNormalized !== emailNormalized)
    ) {
      throw new AuthError("INVITATION_INVALID", "邀请码无效、已使用或已过期。" );
    }

    const intent = await tx.registrationIntent.create({
      data: {
        invitationId: invitation.id,
        intentTokenHash,
        emailNormalized,
        expiresAt,
      },
      select: { id: true },
    });

    return { intentId: intent.id, invitationId: invitation.id };
  });

  return { ...result, intentToken, expiresAt };
}

export async function cancelRegistrationIntent(intentToken: string) {
  const db = getDatabase();
  await db.registrationIntent.updateMany({
    where: { intentTokenHash: hashOpaqueToken(intentToken), status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}

export async function createInvitation(
  context: ActionContext,
  input: {
    roleCode: "OWNER" | "EDITOR" | "VIEWER";
    email?: string;
    expiresInDays: number;
  },
) {
  await authorize({ context, permission: "invitations.manage" });
  const invitationCode = createOpaqueToken(24);
  const db = getDatabase();

  const invitation = await db.$transaction(async (tx) => {
    const role = await tx.role.findFirstOrThrow({
      where: { code: input.roleCode, scope: "HOUSEHOLD" },
      select: { id: true },
    });
    const created = await tx.invitation.create({
      data: {
        householdId: context.householdId,
        roleId: role.id,
        tokenHash: hashOpaqueToken(invitationCode),
        emailNormalized: input.email ? normalizeEmail(input.email) : null,
        expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000),
        createdByUserId: context.userId,
      },
      select: { id: true, expiresAt: true },
    });

    await writeAuditLog(tx, {
      action: "auth.invitation.created",
      entityType: "Invitation",
      entityId: created.id,
      actorUserId: context.userId,
      householdId: context.householdId,
      requestId: context.requestId,
      afterData: {
        roleCode: input.roleCode,
        emailRestricted: Boolean(input.email),
        expiresAt: created.expiresAt.toISOString(),
      },
    });
    return created;
  });

  return { ...invitation, invitationCode };
}

export async function listInvitations(context: ActionContext) {
  await authorize({ context, permission: "invitations.manage" });
  const db = getDatabase();
  return db.invitation.findMany({
    where: { householdId: context.householdId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      emailNormalized: true,
      status: true,
      expiresAt: true,
      consumedAt: true,
      createdAt: true,
      role: { select: { code: true, name: true } },
      createdBy: { select: { displayName: true, emailNormalized: true } },
    },
  });
}

export async function revokeInvitation(context: ActionContext, invitationId: string) {
  await authorize({ context, permission: "invitations.manage" });
  const db = getDatabase();

  return db.$transaction(async (tx) => {
    const invitation = await tx.invitation.findFirst({
      where: { id: invitationId, householdId: context.householdId },
      select: { id: true, status: true },
    });
    if (!invitation) throw new AuthError("INVITATION_INVALID", "邀请码不存在。" );

    if (invitation.status === "ACTIVE") {
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "REVOKED" },
      });
      await tx.registrationIntent.updateMany({
        where: { invitationId: invitation.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      await writeAuditLog(tx, {
        action: "auth.invitation.revoked",
        entityType: "Invitation",
        entityId: invitation.id,
        actorUserId: context.userId,
        householdId: context.householdId,
        requestId: context.requestId,
        beforeData: { status: invitation.status },
        afterData: { status: "REVOKED" },
      });
    }
  });
}
