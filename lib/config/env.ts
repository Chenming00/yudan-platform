const serverEnvironmentKeys = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_SECRET_KEY",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
] as const;

export function getPublicEnvironment() {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function getMissingServerEnvironmentKeys() {
  return serverEnvironmentKeys.filter((key) => !process.env[key]);
}

export const platformDefaults = {
  timezone: process.env.APP_TIME_ZONE ?? "Asia/Shanghai",
  superAdminEmail:
    process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ??
    "william.chen@utah.edu",
} as const;
