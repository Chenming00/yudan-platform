import "server-only";

import { timingSafeEqual } from "node:crypto";

import { AuthError } from "@/lib/auth/errors";
import { hashOpaqueToken } from "@/lib/auth/tokens";
import { getDatabase } from "@/lib/db/client";

function safelyEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function verifyApiCredential(
  credential: string,
  requiredScope: string,
  householdId?: string,
) {
  const [prefix, secret] = credential.split(".", 2);
  if (!prefix || !secret || prefix.length > 16) {
    throw new AuthError("AUTH_REQUIRED", "API 凭证无效。" );
  }

  const secretHash = hashOpaqueToken(secret);
  const db = getDatabase();
  const candidates = await db.apiCredential.findMany({
    where: { keyPrefix: prefix, status: "ACTIVE" },
  });
  const record = candidates.find((candidate) => safelyEqual(candidate.secretHash, secretHash));

  if (
    !record ||
    (record.expiresAt && record.expiresAt <= new Date()) ||
    (householdId && record.householdId !== householdId) ||
    !record.scopes.includes(requiredScope)
  ) {
    throw new AuthError("PERMISSION_DENIED", "API 凭证没有所需权限。" );
  }

  await db.apiCredential.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  return { credentialId: record.id, householdId: record.householdId, createdByUserId: record.createdByUserId };
}
