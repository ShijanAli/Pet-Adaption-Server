import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { PermissionController } from './permissions.controller';
import { PermissionValidation } from './permissions.validation';

const r = createModuleRouter(
  '/permissions',
  'Permissions',
  'Read-only list of permissions (seeded from code)',
);

r.get(
  '/',
  {
    summary: 'List permissions',
    description: 'Use `grouped=true` to get them grouped by module for the role editor UI.',
    access: { permissions: [P.PERMISSION.VIEW] },
    query: PermissionValidation.listQuery,
  },
  PermissionController.getAll,
);

export const permissionRoutes = r;
