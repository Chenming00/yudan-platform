import { z } from "zod";

const email = z.email("请输入有效邮箱").transform((value) => value.trim().toLowerCase());
const password = z
  .string()
  .min(8, "密码至少需要 8 位")
  .max(72, "密码不能超过 72 位");

export const loginSchema = z.object({ email, password });

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(1, "请输入显示名称").max(80, "显示名称过长"),
    email,
    password,
    confirmPassword: z.string(),
    invitationCode: z.string().trim().min(16, "请输入有效邀请码").max(256),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email });
export const updatePasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

export const invitationSchema = z.object({
  householdId: z.uuid("家庭 ID 无效"),
  roleCode: z.enum(["OWNER", "EDITOR", "VIEWER"]),
  email: z.union([z.literal(""), email]).optional(),
  expiresInDays: z.coerce.number().int().min(1).max(30),
});

export const memberUpdateSchema = z.object({
  householdId: z.uuid(),
  userId: z.uuid(),
  roleCode: z.enum(["OWNER", "EDITOR", "VIEWER"]),
  status: z.enum(["ACTIVE", "SUSPENDED", "LEFT"]),
});

export type AuthFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialAuthFormState: AuthFormState = { status: "idle" };
