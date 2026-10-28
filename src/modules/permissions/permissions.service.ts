import { prisma } from '@/lib/prisma';
import type { ListPermissionsQuery } from './permissions.validation';

/** Permissions are defined in code (seeded), so this module is read-only. */
export const PermissionService = {
  async getAll({ module, grouped }: ListPermissionsQuery) {
    const permissions = await prisma.permission.findMany({
      where: module ? { module } : undefined,
      select: { id: true, name: true, slug: true, module: true, description: true },
      orderBy: [{ module: 'asc' }, { slug: 'asc' }],
    });

    if (!grouped) return permissions;

    const groups = new Map<string, typeof permissions>();
    for (const p of permissions) {
      groups.set(p.module, [...(groups.get(p.module) ?? []), p]);
    }
    return [...groups].map(([name, items]) => ({ module: name, permissions: items }));
  },
};
