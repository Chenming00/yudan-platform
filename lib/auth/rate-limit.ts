import { createHash } from "node:crypto";

import { AuthError } from "@/lib/auth/errors";

export interface RateLimitRequest {
  action: "login" | "register" | "forgot-password" | "invitation";
  subject: string;
  limit: number;
  windowMs: number;
}

export interface RateLimiter {
  consume(request: RateLimitRequest): Promise<void>;
}

type Counter = { count: number; resetAt: number };
const counters = new Map<string, Counter>();

export class MemoryRateLimiter implements RateLimiter {
  async consume(request: RateLimitRequest) {
    const now = Date.now();
    const subjectHash = createHash("sha256").update(request.subject).digest("hex");
    const key = `${request.action}:${subjectHash}`;
    const current = counters.get(key);

    if (!current || current.resetAt <= now) {
      counters.set(key, { count: 1, resetAt: now + request.windowMs });
      return;
    }

    if (current.count >= request.limit) {
      throw new AuthError("RATE_LIMITED", "操作太频繁，请稍后再试。" );
    }

    current.count += 1;
  }
}

export const authRateLimiter: RateLimiter = new MemoryRateLimiter();
