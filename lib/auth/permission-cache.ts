import type { PermissionCode } from "@/modules/auth/types";

type Entry = { permissions: ReadonlySet<PermissionCode>; expiresAt: number };
const cache = new Map<string, Entry>();
const ttlMs = 30_000;

function key(userId: string, householdId?: string) {
  return `${userId}:${householdId ?? "global"}`;
}

export function getCachedPermissions(userId: string, householdId?: string) {
  const entry = cache.get(key(userId, householdId));
  if (!entry || entry.expiresAt <= Date.now()) {
    cache.delete(key(userId, householdId));
    return null;
  }
  return entry.permissions;
}

export function setCachedPermissions(
  userId: string,
  householdId: string | undefined,
  permissions: Iterable<PermissionCode>,
) {
  const value = new Set(permissions);
  cache.set(key(userId, householdId), { permissions: value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidatePermissionCache(userId: string) {
  for (const cacheKey of cache.keys()) {
    if (cacheKey.startsWith(`${userId}:`)) cache.delete(cacheKey);
  }
}
