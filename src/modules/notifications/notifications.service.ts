import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import type { NotificationListQuery } from './notifications.validation';

const crud = createCrudService({
  delegate: () => prisma.notification,
  entityName: 'Notification',
  queryConfig: { searchableFields: ['title', 'message'], filterableFields: ['type'] },
});

export const NotificationService = {
  getMine: (userId: number, { unread, ...query }: NotificationListQuery) =>
    crud.getAll(query, {
      userId,
      ...(unread !== undefined && { readAt: unread ? null : { not: null } }),
    }),

  unreadCount: (userId: number) => prisma.notification.count({ where: { userId, readAt: null } }),

  async markRead(userId: number, id: number) {
    const { count } = await prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (count === 0) throw AppError.notFound('Notification');
  },

  async markAllRead(userId: number) {
    const { count } = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  },

  async remove(userId: number, id: number) {
    const { count } = await prisma.notification.deleteMany({ where: { id, userId } });
    if (count === 0) throw AppError.notFound('Notification');
  },
};
