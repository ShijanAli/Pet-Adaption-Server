import bcrypt from 'bcryptjs';
import type { UserStatus } from '@generated/prisma/client';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { SYSTEM_ROLES } from '@/shared/constants/roles';
import { emailService } from '@/shared/services/email.service';
import { generateToken } from '@/shared/utils/common';
import type { AuthUser } from '@/shared/types/auth';
import { userQueryConfig, userRoleInclude } from './users.constant';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.validation';

const crud = createCrudService({
  delegate: () => prisma.user,
  entityName: 'User',
  softDelete: true,
  queryConfig: userQueryConfig,
  include: userRoleInclude,
});

const getTargetWithRole = async (id: number) => {
  const user = await prisma.user.findUnique({ where: { id }, include: userRoleInclude });
  if (!user) throw AppError.notFound('User');
  return user;
};

/** Business rules for managing other accounts */
const assertCanManage = (actor: AuthUser, target: { id: number; role: { slug: string } }) => {
  if (actor.id === target.id) {
    throw AppError.forbidden('You cannot perform this action on your own account');
  }
  if (target.role.slug === SYSTEM_ROLES.SUPER_ADMIN && !actor.isSuperAdmin) {
    throw AppError.forbidden('Only a super admin can manage another super admin');
  }
};

const assertAssignableRole = async (actor: AuthUser, roleId: number) => {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw AppError.badRequest('Role does not exist');
  if (role.status !== 'active') throw AppError.badRequest('Role is inactive');
  if (role.slug === SYSTEM_ROLES.SUPER_ADMIN && !actor.isSuperAdmin) {
    throw AppError.forbidden('Only a super admin can assign the super admin role');
  }
  return role;
};

export const UserService = {
  async getAll(query: ListUsersQuery) {
    const extraWhere =
      query.isVerified === undefined
        ? {}
        : { emailVerifiedAt: query.isVerified ? { not: null } : null };
    return crud.getAll(query, extraWhere);
  },

  getById: crud.getById,

  async create(actor: AuthUser, input: CreateUserInput) {
    const role = await assertAssignableRole(actor, input.roleId);
    const exists = await prisma.user.findFirst({
      where: { email: input.email, deletedAt: undefined },
      select: { id: true },
    });
    if (exists) throw AppError.conflict('Email is already registered');

    const rawPassword = input.password ?? generateToken(16);
    const user = await prisma.user.create({
      data: {
        ...input,
        password: await bcrypt.hash(rawPassword, env.BCRYPT_SALT_ROUNDS),
        // created by an admin → trusted email
        emailVerifiedAt: new Date(),
      },
      include: userRoleInclude,
    });

    emailService.queue({ email: user.email, name: user.firstName }, 'ACCOUNT_CREATED', {
      name: user.firstName,
      email: user.email,
      role: role.name,
    });
    return user;
  },

  async update(id: number, input: UpdateUserInput) {
    return crud.update(id, input);
  },

  async updateStatus(actor: AuthUser, id: number, status: UserStatus) {
    const target = await getTargetWithRole(id);
    assertCanManage(actor, target);

    return prisma.$transaction(async (tx) => {
      if (status !== 'active') {
        // kick the user out of every device
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return tx.user.update({ where: { id }, data: { status }, include: userRoleInclude });
    });
  },

  async updateRole(actor: AuthUser, id: number, roleId: number) {
    const target = await getTargetWithRole(id);
    assertCanManage(actor, target);
    await assertAssignableRole(actor, roleId);
    return prisma.user.update({ where: { id }, data: { roleId }, include: userRoleInclude });
  },

  async remove(actor: AuthUser, id: number) {
    const target = await getTargetWithRole(id);
    assertCanManage(actor, target);

    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      // free the unique email so the person can register again later
      prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'inactive',
          email: `deleted_${id}_${Date.now()}_${target.email}`.slice(0, 150),
        },
      }),
    ]);
  },
};
