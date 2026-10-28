import { prisma, type TransactionClient } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { SYSTEM_ROLES } from '@/shared/constants/roles';
import { permissionCache } from '@/shared/services/permissionCache';
import { assertIdsExist } from '@/shared/utils/db';
import { roleDetailInclude, roleListInclude, roleQueryConfig } from './roles.constant';
import type { CreateRoleInput, ListRolesQuery, UpdateRoleInput } from './roles.validation';

const crud = createCrudService({
  delegate: () => prisma.role,
  entityName: 'Role',
  slugFrom: 'name',
  queryConfig: roleQueryConfig,
  listInclude: roleListInclude,
});

const assertPermissionsExist = (ids: number[]) =>
  assertIdsExist(prisma.permission, ids, 'permission');

const replacePermissions = async (tx: TransactionClient, roleId: number, ids: number[]) => {
  await tx.rolePermission.deleteMany({ where: { roleId } });
  if (ids.length) {
    await tx.rolePermission.createMany({
      data: ids.map((permissionId) => ({ roleId, permissionId })),
    });
  }
};

/** Flattens `permissions: [{ permission: {...} }]` → `permissions: [{...}]` */
const getDetail = async (id: number) => {
  const role = await prisma.role.findUnique({ where: { id }, include: roleDetailInclude });
  if (!role) throw AppError.notFound('Role');
  return { ...role, permissions: role.permissions.map((p) => p.permission) };
};

const getRoleOrThrow = async (id: number) => {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw AppError.notFound('Role');
  return role;
};

export const RoleService = {
  getAll: (query: ListRolesQuery) => crud.getAll(query),

  getById: getDetail,

  async create({ permissionIds, slug, ...input }: CreateRoleInput) {
    await assertPermissionsExist(permissionIds);
    const uniqueSlug = await crud.ensureUniqueSlug(slug ?? input.name);

    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({ data: { ...input, slug: uniqueSlug } });
      await replacePermissions(tx, created.id, permissionIds);
      return created;
    });
    return getDetail(role.id);
  },

  async update(id: number, input: UpdateRoleInput) {
    const role = await getRoleOrThrow(id);
    if (role.slug === SYSTEM_ROLES.SUPER_ADMIN && input.status === 'inactive') {
      throw AppError.forbidden('The super admin role cannot be deactivated');
    }
    await prisma.role.update({ where: { id }, data: input });
    permissionCache.invalidate(id);
    return getDetail(id);
  },

  async remove(id: number) {
    const role = await getRoleOrThrow(id);
    if (role.isSystem) throw AppError.forbidden('System roles cannot be deleted');

    const users = await prisma.user.count({ where: { roleId: id, deletedAt: undefined } });
    if (users > 0) {
      throw AppError.conflict(`This role is assigned to ${users} user(s). Reassign them first`);
    }
    await prisma.role.delete({ where: { id } });
    permissionCache.invalidate(id);
  },

  async assignPermissions(id: number, permissionIds: number[]) {
    const role = await getRoleOrThrow(id);
    if (role.slug === SYSTEM_ROLES.SUPER_ADMIN) {
      throw AppError.forbidden('Super admin always has every permission');
    }
    await assertPermissionsExist(permissionIds);
    await prisma.$transaction((tx) => replacePermissions(tx, id, permissionIds));
    permissionCache.invalidate(id);
    return getDetail(id);
  },
};
