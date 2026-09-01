import { describe, expect, it } from "vitest";

import { getSupabaseProjectRef, validateDeploymentEnvironment, type DeploymentEnvironment } from "@/lib/config/deployment";

const productionRef = "bmrkjsomdbypqoaidsck";

function environment(ref = productionRef): DeploymentEnvironment {
  return {
    NEXT_PUBLIC_APP_URL: "https://cyz.ykn.cm",
    NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
    SUPABASE_SECRET_KEY: "secret",
    DATABASE_URL: `postgresql://postgres.${ref}:password@ap-northeast-1.pooler.supabase.com:6543/postgres`,
    DIRECT_URL: `postgresql://postgres:password@db.${ref}.supabase.co:5432/postgres`,
    SUPER_ADMIN_EMAIL: "william.chen@utah.edu",
    CLOUDFLARE_ACCOUNT_ID: "account",
    R2_ACCESS_KEY_ID: "access",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_PRIVATE_BUCKET: "cyz-private",
    R2_PUBLIC_BUCKET: "cyz-public",
    R2_PUBLIC_BASE_URL: "https://cf-cyz.ykn.cm",
    CRON_SECRET: "cron",
    PRODUCTION_SUPABASE_PROJECT_REF: productionRef,
    DEPLOYMENT_DATABASE_SCOPE: "production",
    R2_ENVIRONMENT_SCOPE: "production",
  };
}

describe("deployment readiness", () => {
  it("accepts the approved production topology", () => {
    expect(validateDeploymentEnvironment(environment(), "production")).toEqual([]);
  });

  it("requires preview resources to be isolated from production", () => {
    const issues = validateDeploymentEnvironment(environment(), "preview");
    expect(issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      "Preview 禁止连接生产 Supabase 项目。",
      "Preview 禁止使用生产 R2 Bucket。",
    ]));
  });

  it("accepts a fully isolated preview topology", () => {
    const preview = environment("previewprojectref");
    Object.assign(preview, {
      NEXT_PUBLIC_APP_URL: "https://yudan-platform-preview.vercel.app",
      R2_PRIVATE_BUCKET: "cyz-private-preview",
      R2_PUBLIC_BUCKET: "cyz-public-preview",
      R2_PUBLIC_BASE_URL: "https://assets-preview.example.test",
      DEPLOYMENT_DATABASE_SCOPE: "preview",
      R2_ENVIRONMENT_SCOPE: "preview",
    });
    expect(validateDeploymentEnvironment(preview, "preview")).toEqual([]);
  });

  it("detects a database URL connected to another Supabase project", () => {
    const mismatched = environment();
    mismatched.DIRECT_URL = "postgresql://postgres:password@db.otherproject.supabase.co:5432/postgres";
    expect(validateDeploymentEnvironment(mismatched, "production")).toContainEqual({
      key: "DIRECT_URL",
      message: "数据库连接与公开 Supabase 项目不一致。",
    });
  });

  it("extracts only a valid Supabase project reference", () => {
    expect(getSupabaseProjectRef(environment())).toBe(productionRef);
    expect(getSupabaseProjectRef({ NEXT_PUBLIC_SUPABASE_URL: "https://example.com" })).toBeNull();
  });
});
