export type DeploymentTarget = "preview" | "production";

export type DeploymentEnvironmentIssue = {
  key: string;
  message: string;
};

export type DeploymentEnvironment = Record<string, string | undefined>;

const requiredKeys = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPER_ADMIN_EMAIL",
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PRIVATE_BUCKET",
  "R2_PUBLIC_BUCKET",
  "R2_PUBLIC_BASE_URL",
  "CRON_SECRET",
  "PRODUCTION_SUPABASE_PROJECT_REF",
  "DEPLOYMENT_DATABASE_SCOPE",
  "R2_ENVIRONMENT_SCOPE",
] as const;

const production = {
  appUrl: "https://cyz.ykn.cm",
  privateBucket: "cyz-private",
  publicBucket: "cyz-public",
  publicBaseUrl: "https://cf-cyz.ykn.cm",
  superAdminEmail: "william.chen@utah.edu",
} as const;

function parseUrl(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function getSupabaseProjectRef(environment: DeploymentEnvironment) {
  const publicUrl = parseUrl(environment.NEXT_PUBLIC_SUPABASE_URL);
  return publicUrl?.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1] ?? null;
}

function databaseUrlMatchesProject(value: string | undefined, projectRef: string) {
  const url = parseUrl(value);
  if (!url) return false;
  return url.hostname === `db.${projectRef}.supabase.co` ||
    decodeURIComponent(url.username).endsWith(`.${projectRef}`);
}

export function validateDeploymentEnvironment(
  environment: DeploymentEnvironment,
  target: DeploymentTarget,
) {
  const issues: DeploymentEnvironmentIssue[] = [];
  for (const key of requiredKeys) {
    if (!environment[key]?.trim()) {
      issues.push({ key, message: "缺少必需的部署变量。" });
    }
  }

  const appUrl = parseUrl(environment.NEXT_PUBLIC_APP_URL);
  const publicBaseUrl = parseUrl(environment.R2_PUBLIC_BASE_URL);
  if (appUrl?.protocol !== "https:") {
    issues.push({ key: "NEXT_PUBLIC_APP_URL", message: "部署地址必须使用 HTTPS。" });
  }
  if (publicBaseUrl?.protocol !== "https:") {
    issues.push({ key: "R2_PUBLIC_BASE_URL", message: "公开资源地址必须使用 HTTPS。" });
  }

  const projectRef = getSupabaseProjectRef(environment);
  if (!projectRef) {
    issues.push({ key: "NEXT_PUBLIC_SUPABASE_URL", message: "Supabase 项目地址格式无效。" });
  } else {
    for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
      if (!databaseUrlMatchesProject(environment[key], projectRef)) {
        issues.push({ key, message: "数据库连接与公开 Supabase 项目不一致。" });
      }
    }
  }

  const productionRef = environment.PRODUCTION_SUPABASE_PROJECT_REF?.trim();
  if (target === "production") {
    const exactValues = [
      ["NEXT_PUBLIC_APP_URL", production.appUrl],
      ["R2_PRIVATE_BUCKET", production.privateBucket],
      ["R2_PUBLIC_BUCKET", production.publicBucket],
      ["R2_PUBLIC_BASE_URL", production.publicBaseUrl],
      ["SUPER_ADMIN_EMAIL", production.superAdminEmail],
      ["DEPLOYMENT_DATABASE_SCOPE", "production"],
      ["R2_ENVIRONMENT_SCOPE", "production"],
    ] as const;
    for (const [key, expected] of exactValues) {
      if (environment[key]?.trim().toLowerCase() !== expected) {
        issues.push({ key, message: "生产环境变量与批准值不一致。" });
      }
    }
    if (projectRef && productionRef && projectRef !== productionRef) {
      issues.push({ key: "NEXT_PUBLIC_SUPABASE_URL", message: "生产环境未连接批准的 Supabase 项目。" });
    }
  } else {
    if (environment.DEPLOYMENT_DATABASE_SCOPE !== "preview") {
      issues.push({ key: "DEPLOYMENT_DATABASE_SCOPE", message: "Preview 必须使用隔离数据库。" });
    }
    if (environment.R2_ENVIRONMENT_SCOPE !== "preview") {
      issues.push({ key: "R2_ENVIRONMENT_SCOPE", message: "Preview 必须使用隔离 R2 Bucket。" });
    }
    if (projectRef && productionRef && projectRef === productionRef) {
      issues.push({ key: "NEXT_PUBLIC_SUPABASE_URL", message: "Preview 禁止连接生产 Supabase 项目。" });
    }
    if (environment.NEXT_PUBLIC_APP_URL === production.appUrl) {
      issues.push({ key: "NEXT_PUBLIC_APP_URL", message: "Preview 禁止使用生产主站地址。" });
    }
    const productionBuckets: string[] = [production.privateBucket, production.publicBucket];
    if (productionBuckets.includes(environment.R2_PRIVATE_BUCKET ?? "") ||
        productionBuckets.includes(environment.R2_PUBLIC_BUCKET ?? "")) {
      issues.push({ key: "R2_PRIVATE_BUCKET", message: "Preview 禁止使用生产 R2 Bucket。" });
    }
  }

  return issues;
}
