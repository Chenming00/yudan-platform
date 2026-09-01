import "server-only";

import { redirect } from "next/navigation";

import { AuthError } from "@/lib/auth/errors";
import { normalizeEmail } from "@/lib/auth/tokens";
import { platformDefaults } from "@/lib/config/env";
import { bootstrapSuperAdmin } from "@/lib/db/bootstrap-super-admin";
import { getDatabase } from "@/lib/db/client";
import { createClient } from "@/lib/supabase/server";

export interface PlatformActor {
  userId: string;
  email: string;
  displayName: string | null;
  householdIds: string[];
  isSuperAdmin: boolean;
}

export async function getPlatformActor(): Promise<PlatformActor | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) return null;

  const db = getDatabase();
  const email = normalizeEmail(user.email);
  const emailVerified = Boolean(user.email_confirmed_at);

  if (emailVerified && email === platformDefaults.superAdminEmail) {
    await bootstrapSuperAdmin(db, {
      authUserId: user.id,
      email,
      displayName:
        typeof user.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name
          : undefined,
    });
  } else if (emailVerified) {
    await db.appUser.updateMany({
      where: { id: user.id, status: "PENDING_VERIFICATION" },
      data: { status: "ACTIVE", lastLoginAt: new Date() },
    });
  }

  const profile = await db.appUser.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      emailNormalized: true,
      displayName: true,
      status: true,
      memberships: {
        where: { status: "ACTIVE" },
        select: { householdId: true },
      },
      globalRoles: {
        where: { role: { code: "SUPER_ADMIN" } },
        select: { roleId: true },
      },
    },
  });

  if (!profile) {
    await supabase.auth.signOut({ scope: "local" });
    throw new AuthError("ACCOUNT_INACTIVE", "该登录账号尚未获准进入平台。" );
  }

  if (!emailVerified || profile.status === "PENDING_VERIFICATION") {
    await supabase.auth.signOut({ scope: "local" });
    throw new AuthError("EMAIL_NOT_VERIFIED", "请先完成邮箱验证。" );
  }

  if (profile.status !== "ACTIVE") {
    await supabase.auth.signOut({ scope: "local" });
    throw new AuthError("ACCOUNT_INACTIVE", "账号已停用，请联系管理员。" );
  }

  if (profile.emailNormalized !== email) {
    await db.appUser.update({
      where: { id: profile.id },
      data: { emailNormalized: email, lastLoginAt: new Date() },
    });
  }

  return {
    userId: profile.id,
    email,
    displayName: profile.displayName,
    householdIds: profile.memberships.map((membership) => membership.householdId),
    isSuperAdmin: profile.globalRoles.length > 0,
  };
}

export async function requirePlatformActor() {
  try {
    const actor = await getPlatformActor();
    if (actor) return actor;
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect("/login");
}
