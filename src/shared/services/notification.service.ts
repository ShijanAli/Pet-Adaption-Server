import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { SYSTEM_ROLES } from '@/shared/constants/roles';

export type NotificationInput = {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
};

const ADMIN_ROLES: string[] = [SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN];

/**
 * In-app notifications (read through /me/notifications in Phase 6).
 * Fire-and-forget: a failed notification never breaks the main action.
 */
export const notificationService = {
  notify(userId: number, input: NotificationInput) {
    prisma.notification
      .create({ data: { userId, ...input, data: input.data as object | undefined } })
      .catch((err) =>
        logger.error({ err, userId, type: input.type }, 'Failed to create notification'),
      );
  },

  /** One notification per user (duplicates and nulls ignored) */
  notifyMany(userIds: Array<number | null | undefined>, input: NotificationInput) {
    const ids = [...new Set(userIds.filter((id): id is number => typeof id === 'number'))];
    if (ids.length === 0) return;
    prisma.notification
      .createMany({
        data: ids.map((userId) => ({
          userId,
          ...input,
          data: input.data as object | undefined,
        })),
      })
      .catch((err) => logger.error({ err, type: input.type }, 'Failed to create notifications'));
  },

  /**
   * Notify every active Super Admin / Admin, plus any extra users (e.g. the assigned staff member).
   * Staff and admins only ever received nothing before — customers were the only recipients.
   */
  notifyAdmins(input: NotificationInput, extraUserIds: Array<number | null | undefined> = []) {
    prisma.user
      .findMany({
        where: { status: 'active', role: { slug: { in: ADMIN_ROLES } } },
        select: { id: true },
      })
      .then((admins) =>
        notificationService.notifyMany([...admins.map((a) => a.id), ...extraUserIds], input),
      )
      .catch((err) => logger.error({ err, type: input.type }, 'Failed to notify admins'));
  },
};
