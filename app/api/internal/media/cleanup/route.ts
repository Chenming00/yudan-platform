import { NextResponse } from "next/server";

import { apiFailure, apiSuccess } from "@/lib/api/response";
import { requestIdFrom } from "@/lib/api/ledger";
import { cleanupAllMedia } from "@/modules/media";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(apiFailure("AUTH_REQUIRED", "未授权的清理请求。", requestId), { status: 401 });
  }
  try {
    return NextResponse.json(apiSuccess(await cleanupAllMedia(), requestId));
  } catch {
    return NextResponse.json(apiFailure("INTERNAL_ERROR", "资源清理暂时失败。", requestId), { status: 500 });
  }
}
