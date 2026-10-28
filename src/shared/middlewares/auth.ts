import type { NextFunction, Request, Response } from 'express';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { verifyAccessToken } from '@/shared/utils/jwt';
import { permissionCache } from '@/shared/services/permissionCache';
import { SYSTEM_ROLES } from '@/shared/constants/roles';
import type { PermissionSlug } from '@/shared/constants/permissions';

const extractBearer = (req: Request) => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
};

/**
 * Verifies the access token and loads the user on every request,
 * so blocked users / role changes take effect immediately.
 */
export const authenticate =
  (options: { optional?: boolean } = {}) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearer(req);
    if (!token) {
      if (options.optional) return next();
      throw AppError.unauthorized('Authentication required');
    }

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        roleId: true,
        role: { select: { slug: true, status: true } },
      },
    });

    if (!user) throw AppError.unauthorized('User no longer exists');
    if (user.status !== 'active') throw AppError.forbidden(`Your account is ${user.status}`);
    if (user.role.status !== 'active') throw AppError.forbidden('Your role is currently inactive');

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
      roleSlug: user.role.slug,
      isSuperAdmin: user.role.slug === SYSTEM_ROLES.SUPER_ADMIN,
    };
    next();
  };

/** Requires ALL listed permissions. Super admin always passes. */
export const authorize =
  (...required: PermissionSlug[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw AppError.unauthorized('Authentication required');
    if (req.user.isSuperAdmin || required.length === 0) return next();

    const granted = await permissionCache.get(req.user.roleId);
    const missing = required.filter((p) => !granted.has(p));
    if (missing.length) {
      throw AppError.forbidden(`Missing permission: ${missing.join(', ')}`);
    }
    next();
  };
