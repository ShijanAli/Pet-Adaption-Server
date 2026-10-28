import type { PermissionSlug } from '@/shared/constants/permissions';
import { permissionCache } from '@/shared/services/permissionCache';
import type { AuthUser } from '@/shared/types/auth';

/**
 * For routes with `access: 'optional'`: lets one endpoint serve both the public site
 * (active items only) and the admin panel (everything) depending on the caller.
 */
export const hasPermission = async (user: AuthUser | undefined, permission: PermissionSlug) => {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return (await permissionCache.get(user.roleId)).has(permission);
};
