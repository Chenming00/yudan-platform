"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthError, publicAuthMessage } from "@/lib/auth/errors";
import { authRateLimiter } from "@/lib/auth/rate-limit";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { getPlatformActor, requirePlatformActor } from "@/lib/auth/session";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  updatePasswordSchema,
  type AuthFormState,
} from "@/lib/auth/validation";
import { getPublicEnvironment } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/server";
import { cancelRegistrationIntent, createRegistrationIntent } from "@/modules/auth";

async function rateLimitSubject(email: string) {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${forwardedFor ?? "unknown"}:${email}`;
}

function invalidState(error: { flatten(): { fieldErrors: Record<string, string[]> } }): AuthFormState {
  return {
    status: "error",
    message: "请检查表单内容。",
    fieldErrors: error.flatten().fieldErrors,
  };
}

export async function loginAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    await authRateLimiter.consume({
      action: "login",
      subject: await rateLimitSubject(parsed.data.email),
      limit: 10,
      windowMs: 15 * 60 * 1_000,
    });
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { status: "error", message: "邮箱或密码不正确。" };

    await getPlatformActor();
  } catch (error) {
    return { status: "error", message: publicAuthMessage(error) };
  }

  redirect(getSafeRedirectPath(formData.get("next")?.toString(), "/"));
}

export async function registerAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error);

  let intentToken: string | undefined;
  try {
    await authRateLimiter.consume({
      action: "register",
      subject: await rateLimitSubject(parsed.data.email),
      limit: 5,
      windowMs: 60 * 60 * 1_000,
    });
    const intent = await createRegistrationIntent({
      email: parsed.data.email,
      invitationCode: parsed.data.invitationCode,
    });
    intentToken = intent.intentToken;

    const supabase = await createClient();
    const { appUrl } = getPublicEnvironment();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback?next=/`,
        data: {
          display_name: parsed.data.displayName,
          registration_intent: intent.intentToken,
        },
      },
    });

    if (error || !data.user || data.user.identities?.length === 0) {
      await cancelRegistrationIntent(intent.intentToken);
      return {
        status: "error",
        message: error?.message.includes("hook")
          ? "邀请码无效、已使用或已过期。"
          : "注册未完成；如果该邮箱已有账号，请直接登录或找回密码。",
      };
    }
  } catch (error) {
    if (intentToken) await cancelRegistrationIntent(intentToken);
    return { status: "error", message: publicAuthMessage(error) };
  }

  return {
    status: "success",
    message: "注册成功。请查收验证邮件，验证后即可登录。",
  };
}

export async function forgotPasswordAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    await authRateLimiter.consume({
      action: "forgot-password",
      subject: await rateLimitSubject(parsed.data.email),
      limit: 5,
      windowMs: 60 * 60 * 1_000,
    });
    const supabase = await createClient();
    const { appUrl } = getPublicEnvironment();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
    });
  } catch (error) {
    if (error instanceof AuthError && error.code === "RATE_LIMITED") {
      return { status: "error", message: error.message };
    }
  }

  return {
    status: "success",
    message: "如果该邮箱已注册，我们会发送密码重置邮件。",
  };
}

export async function updatePasswordAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { status: "error", message: "重置链接无效或已过期。" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: "密码更新失败，请重新申请重置邮件。" };
  return { status: "success", message: "密码已更新，现在可以正常登录。" };
}

export async function githubSignInAction() {
  const supabase = await createClient();
  const { appUrl } = getPublicEnvironment();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${appUrl}/auth/callback?next=/` },
  });
  if (error || !data.url) redirect("/login?error=GitHub%20登录暂不可用");
  redirect(data.url);
}

export async function linkGithubIdentityAction() {
  await requirePlatformActor();
  const supabase = await createClient();
  const { appUrl } = getPublicEnvironment();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "github",
    options: { redirectTo: `${appUrl}/auth/callback?next=/settings` },
  });
  if (error || !data.url) redirect("/settings?error=GitHub%20绑定暂不可用");
  redirect(data.url);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
