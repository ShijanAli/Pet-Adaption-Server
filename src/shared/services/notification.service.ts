import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type NotificationInput = {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
};

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
};
