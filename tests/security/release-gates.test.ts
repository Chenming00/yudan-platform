import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { isUntrustedMutationRequest } from "@/lib/api/request-security";
import { requestHash } from "@/application/shared";
import { buildLedgerReport } from "@/scripts/migration/report";

function request(method: string, origin?: string, fetchSite?: string) {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  if (fetchSite) headers.set("sec-fetch-site", fetchSite);
  return { method, url: "https://cyz.ykn.cm/api/ledger/transactions", headers };
}

describe("release security gates", () => {
  it("rejects cross-origin mutations but permits reads and non-browser API clients", () => {
    expect(isUntrustedMutationRequest(request("POST", "https://evil.ykn.cm", "same-site"))).toBe(true);
    expect(isUntrustedMutationRequest(request("POST", "https://attacker.example", "cross-site"))).toBe(true);
    expect(isUntrustedMutationRequest(request("POST", "https://cyz.ykn.cm", "same-origin"))).toBe(false);
    expect(isUntrustedMutationRequest(request("POST"))).toBe(false);
    expect(isUntrustedMutationRequest(request("GET", "https://attacker.example", "cross-site"))).toBe(false);
  });

  it("keeps invitation consumption atomic and inaccessible to browser roles", () => {
    const migration = readFileSync(resolve("prisma/migrations/20260901120000_platform_foundation/migration.sql"), "utf8");
    expect(migration).toContain("FOR UPDATE OF intent, invitation");
    expect(migration).toContain("SET status = 'CONSUMED'");
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION private.before_user_created(JSONB) FROM PUBLIC, anon, authenticated");
  });

  it("enforces least-privilege RLS and household isolation", () => {
    const migration = readFileSync(resolve("prisma/migrations/20260901120000_platform_foundation/migration.sql"), "utf8");
    expect(migration).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated");
    expect(migration).toContain("private.is_household_member(\"household_id\")");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).not.toContain("auth.role()");
  });

  it("scopes API keys by permission and household", () => {
    const credentials = readFileSync(resolve("lib/auth/api-credentials.ts"), "utf8");
    expect(credentials).toContain("record.householdId !== householdId");
    expect(credentials).toContain("!record.scopes.includes(requiredScope)");
    expect(credentials).toContain("timingSafeEqual");
  });

  it("makes idempotency hashes key-order independent", () => {
    expect(requestHash({ amount: "10.00", nested: { b: 2, a: 1 } })).toBe(
      requestHash({ nested: { a: 1, b: 2 }, amount: "10.00" }),
    );
  });

  it("keeps exact decimal migration totals", () => {
    const rows = Array.from({ length: 100 }, (_, index) => ({
      amount: "0.01",
      category: index % 2 ? "医疗健康" : "衣物穿戴",
      type: "expense" as const,
      occurredAt: new Date("2026-09-01T00:00:00Z"),
    }));
    expect(buildLedgerReport(rows).expense).toBe("1.00");
  });

  it("keeps private media in a non-public bucket and validates real content", () => {
    const media = readFileSync(resolve("modules/media/service.ts"), "utf8");
    expect(media).toContain("Even public assets first land in the private bucket");
    expect(media).toContain("hasValidMagicBytes");
    expect(media).toContain("householdId: context.householdId");
    expect(media).toContain("createDownloadUrl(asset.bucket, asset.objectKey, downloadExpirySeconds)");
  });
});
