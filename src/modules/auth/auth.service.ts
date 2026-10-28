import bcrypt from 'bcryptjs';
import type { TokenType } from '@generated/prisma/client';
import { env } from '@/config/env';
import { prisma, type TransactionClient } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { SYSTEM_ROLES } from '@/shared/constants/roles';
import { emailService } from '@/shared/services/email.service';
import { addDays, addMinutes, generateToken, hashToken } from '@/shared/utils/common';
import { signAccessToken } from '@/shared/utils/jwt';
import { userRoleInclude } from '@/modules/users/users.constant';
import type { ClientMeta, TokenPair } from './auth.interface';
import type { LoginInput, RegisterInput, UpdateMeInput } from './auth.validation';

/* ───────────────────────── helpers ───────────────────────── */

const issueTokens = async (
  db: TransactionClient | typeof prisma,
  user: { id: number; roleId: number },
  meta: ClientMeta,
): Promise<TokenPair> => {
  const refreshToken = generateToken(48);
  await db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      userAgent: meta.userAgent?.slice(0, 255),
      ipAddress: meta.ipAddress?.slice(0, 45),
      expiresAt: addDays(new Date(), env.JWT_REFRESH_EXPIRES_IN_DAYS),
    },
  });
  return {
    accessToken: signAccessToken({ sub: String(user.id), roleId: user.roleId }),
    refreshToken,
  };
};

const revokeAllRefreshTokens = (
  db: TransactionClient | typeof prisma,
  userId: number,
  exceptTokenHash?: string,
) =>
  db.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptTokenHash && { NOT: { tokenHash: exceptTokenHash } }),
    },
    data: { revokedAt: new Date() },
  });

/** Creates a one-time token (only its hash is stored) and invalidates older ones of the same type */
const createVerificationToken = async (userId: number, type: TokenType) => {
  const token = generateToken(32);
  const minutes =
    type === 'email_verify'
      ? env.EMAIL_VERIFY_TOKEN_EXPIRES_MINUTES
      : env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES;

  await prisma.$transaction([
    prisma.verificationToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.verificationToken.create({
      data: {
        userId,
        type,
        tokenHash: hashToken(token),
        expiresAt: addMinutes(new Date(), minutes),
      },
    }),
  ]);
  return token;
};

/** Marks a one-time token as used (atomically) and returns its user id */
const consumeVerificationToken = async (tx: TransactionClient, token: string, type: TokenType) => {
  const record = await tx.verificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
    throw AppError.badRequest('This link is invalid or has expired');
  }
  // conditional update protects against the same token being used twice concurrently
  const { count } = await tx.verificationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count === 0) throw AppError.badRequest('This link is invalid or has expired');
  return record.userId;
};

const findActiveUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email }, omit: { password: false } });

/* ───────────────────────── service ───────────────────────── */

export const AuthService = {
  async register(input: RegisterInput) {
    const exists = await prisma.user.findFirst({
      where: { email: input.email, deletedAt: undefined },
      select: { id: true },
    });
    if (exists) throw AppError.conflict('Email is already registered');

    const customerRole = await prisma.role.findUnique({ where: { slug: SYSTEM_ROLES.CUSTOMER } });
    if (!customerRole) throw new Error('Customer role is missing — run the database seed');

    const user = await prisma.user.create({
      data: {
        ...input,
        password: await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS),
        roleId: customerRole.id,
      },
      include: userRoleInclude,
    });

    const token = await createVerificationToken(user.id, 'email_verify');
    emailService.queue({ email: user.email, name: user.firstName }, 'EMAIL_VERIFY', {
      name: user.firstName,
      token,
    });
    return user;
  },

  async verifyEmail(token: string) {
    await prisma.$transaction(async (tx) => {
      const userId = await consumeVerificationToken(tx, token, 'email_verify');
      await tx.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });
    });
  },

  /** Always resolves the same way so attackers cannot discover registered emails */
  async resendVerification(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt || user.status !== 'active') return;
    const token = await createVerificationToken(user.id, 'email_verify');
    emailService.queue({ email: user.email, name: user.firstName }, 'EMAIL_VERIFY', {
      name: user.firstName,
      token,
    });
  },

  async login(input: LoginInput, meta: ClientMeta) {
    const user = await findActiveUserByEmail(input.email);
    // same message for "no user" and "wrong password"
    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw AppError.unauthorized('Invalid email or password');
    }
    if (user.status !== 'active') throw AppError.forbidden(`Your account is ${user.status}`);
    if (!user.emailVerifiedAt) {
      throw AppError.forbidden('Please verify your email address before logging in');
    }

    const tokens = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return issueTokens(tx, user, meta);
    });

    const profile = await AuthService.getMe(user.id);
    return { ...tokens, user: profile };
  },

  /** Refresh token rotation with reuse detection */
  async refresh(refreshToken: string | undefined, meta: ClientMeta): Promise<TokenPair> {
    if (!refreshToken) throw AppError.unauthorized('Refresh token missing');
    const tokenHash = hashToken(refreshToken);

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, roleId: true, status: true, deletedAt: true } } },
    });
    if (!stored) throw AppError.unauthorized('Invalid refresh token');

    if (stored.revokedAt) {
      // a rotated token was used again → likely stolen. Log out every session.
      await revokeAllRefreshTokens(prisma, stored.userId);
      throw AppError.unauthorized('Session expired, please login again');
    }
    if (stored.expiresAt < new Date()) throw AppError.unauthorized('Refresh token expired');
    if (stored.user.deletedAt || stored.user.status !== 'active') {
      throw AppError.unauthorized('Account is not active');
    }

    return prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) throw AppError.unauthorized('Session expired, please login again');
      return issueTokens(tx, stored.user, meta);
    });
  },

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'active') return;
    const token = await createVerificationToken(user.id, 'password_reset');
    emailService.queue({ email: user.email, name: user.firstName }, 'PASSWORD_RESET', {
      name: user.firstName,
      token,
    });
  },

  async resetPassword(token: string, password: string) {
    const user = await prisma.$transaction(async (tx) => {
      const userId = await consumeVerificationToken(tx, token, 'password_reset');
      const updated = await tx.user.update({
        where: { id: userId },
        data: { password: await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS) },
      });
      // the user proved access to the inbox → treat the email as verified
      await tx.user.updateMany({
        where: { id: userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });
      await revokeAllRefreshTokens(tx, userId);
      return updated;
    });
    emailService.queue({ email: user.email, name: user.firstName }, 'PASSWORD_CHANGED', {
      name: user.firstName,
    });
  },

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    currentRefreshToken?: string,
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId }, omit: { password: false } });
    if (!user) throw AppError.notFound('User');
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      throw AppError.badRequest('Current password is incorrect', [
        { path: 'currentPassword', message: 'Incorrect password' },
      ]);
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { password: await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS) },
      });
      // log out other devices, keep this one
      await revokeAllRefreshTokens(
        tx,
        userId,
        currentRefreshToken ? hashToken(currentRefreshToken) : undefined,
      );
    });
    emailService.queue({ email: user.email, name: user.firstName }, 'PASSWORD_CHANGED', {
      name: user.firstName,
    });
  },

  /** Profile + permission slugs (frontend uses them to show/hide UI) */
  async getMe(userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: userRoleInclude });
    if (!user) throw AppError.notFound('User');

    const permissions =
      user.role.slug === SYSTEM_ROLES.SUPER_ADMIN
        ? await prisma.permission.findMany({ select: { slug: true } })
        : (
            await prisma.rolePermission.findMany({
              where: { roleId: user.roleId },
              select: { permission: { select: { slug: true } } },
            })
          ).map((rp) => rp.permission);

    return { ...user, permissions: permissions.map((p) => p.slug).sort() };
  },

  async updateMe(userId: number, input: UpdateMeInput) {
    await prisma.user.update({ where: { id: userId }, data: input });
    return AuthService.getMe(userId);
  },
};
