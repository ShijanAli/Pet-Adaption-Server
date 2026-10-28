import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { RoleController } from './roles.controller';
import { RoleValidation } from './roles.validation';

const r = createModuleRouter('/roles', 'Roles', 'Role management (RBAC)');

r.get(
  '/',
  {
    summary: 'List roles',
    access: { permissions: [P.ROLE.VIEW] },
    query: RoleValidation.listQuery,
  },
  RoleController.getAll,
);

r.post(
  '/',
  {
    summary: 'Create a role',
    description: '`slug` is generated from `name` when omitted.',
    access: { permissions: [P.ROLE.CREATE] },
    body: RoleValidation.create,
  },
  RoleController.create,
);

r.get(
  '/:id',
  {
    summary: 'Get a role with its permissions',
    access: { permissions: [P.ROLE.VIEW] },
    params: idParam,
  },
  RoleController.getById,
);

r.patch(
  '/:id',
  {
    summary: 'Update a role',
    access: { permissions: [P.ROLE.UPDATE] },
    params: idParam,
    body: RoleValidation.update,
  },
  RoleController.update,
);

r.delete(
  '/:id',
  {
    summary: 'Delete a role',
    description: 'System roles and roles assigned to users cannot be deleted.',
    access: { permissions: [P.ROLE.DELETE] },
    params: idParam,
  },
  RoleController.remove,
);

r.put(
  '/:id/permissions',
  {
    summary: 'Replace the permissions of a role',
    access: { permissions: [P.ROLE.ASSIGN_PERMISSION] },
    params: idParam,
    body: RoleValidation.assignPermissions,
  },
  RoleController.assignPermissions,
);

export const roleRoutes = r;
