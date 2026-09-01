import { NextResponse } from "next/server";

import { validateDeploymentEnvironment, type DeploymentTarget } from "@/lib/config/deployment";
import { getDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  const readiness = new URL(request.url).searchParams.get("mode") === "ready";
  const revision = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local";
  if (!readiness) return response({ status: "ok", service: "yudan-platform", revision });

  const target: DeploymentTarget = process.env.VERCEL_ENV === "production" ? "production" : "preview";
  const issues = validateDeploymentEnvironment(process.env, target);
  if (issues.length > 0) {
    return response({ status: "unavailable", service: "yudan-platform", revision, checks: { configuration: "failed" } }, 503);
  }

  try {
    await getDatabase().$queryRaw`SELECT 1`;
    return response({ status: "ready", service: "yudan-platform", revision, checks: { configuration: "ok", database: "ok" } });
  } catch {
    return response({ status: "unavailable", service: "yudan-platform", revision, checks: { configuration: "ok", database: "failed" } }, 503);
  }
}
