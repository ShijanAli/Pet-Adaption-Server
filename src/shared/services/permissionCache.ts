import { prisma } from '@/lib/prisma';

const TTL_MS = 5 * 60 * 1000;

type Entry = { permissions: Set<string>; expiresAt: number };

const cache = new Map<number, Entry>();

/**
 * Role → permission slugs, cached in memory.
 * Invalidated whenever a role's permissions change, so updates apply instantly.
 * (Swap the Map for Redis when running more than one server instance.)
 */
export const permissionCache = {
  async get(roleId: number): Promise<Set<string>> {
    const hit = cache.get(roleId);
    if (hit && hit.expiresAt > Date.now()) return hit.permissions;

    const rows = await prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { slug: true } } },
    });
    const permissions = new Set(rows.map((r) => r.permission.slug));
    cache.set(roleId, { permissions, expiresAt: Date.now() + TTL_MS });
    return permissions;
  },

  invalidate(roleId?: number) {
    if (roleId === undefined) cache.clear();
    else cache.delete(roleId);
  },
};
