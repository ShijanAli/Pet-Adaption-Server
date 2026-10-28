import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { UserController } from './users.controller';
import { UserValidation } from './users.validation';

const r = createModuleRouter('/users', 'Users', 'Admin user management');

r.get(
  '/',
  {
    summary: 'List users',
    description: 'Search: firstName, lastName, email, phone',
    access: { permissions: [P.USER.VIEW] },
    query: UserValidation.listQuery,
  },
  UserController.getAll,
);

r.post(
  '/',
  {
    summary: 'Create a user (staff / admin / customer)',
    description:
      'Password is optional — when omitted the user gets an email to set one via "forgot password".',
    access: { permissions: [P.USER.CREATE] },
    body: UserValidation.create,
  },
  UserController.create,
);

r.get(
  '/:id',
  { summary: 'Get a user', access: { permissions: [P.USER.VIEW] }, params: idParam },
  UserController.getById,
);

r.patch(
  '/:id',
  {
    summary: 'Update user profile',
    access: { permissions: [P.USER.UPDATE] },
    params: idParam,
    body: UserValidation.update,
  },
  UserController.update,
);

r.patch(
  '/:id/status',
  {
    summary: 'Activate / deactivate / block a user',
    description: 'Blocking or deactivating logs the user out from every device.',
    access: { permissions: [P.USER.UPDATE] },
    params: idParam,
    body: UserValidation.updateStatus,
  },
  UserController.updateStatus,
);

r.patch(
  '/:id/role',
  {
    summary: 'Change user role',
    access: { permissions: [P.USER.UPDATE] },
    params: idParam,
    body: UserValidation.updateRole,
  },
  UserController.updateRole,
);

r.delete(
  '/:id',
  {
    summary: 'Delete a user (soft delete)',
    access: { permissions: [P.USER.DELETE] },
    params: idParam,
  },
  UserController.remove,
);

export const userRoutes = r;
