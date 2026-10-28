import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { idParam } from '@/shared/utils/validation';
import { NotificationController } from './notifications.controller';
import { NotificationValidation } from './notifications.validation';

const r = createModuleRouter(
  '/me/notifications',
  'My Notifications',
  'In-app notifications (booking, payment, adoption, review updates)',
);

r.get(
  '/',
  {
    summary: 'List my notifications',
    description: 'Filter `unread=true` for the bell dropdown; badge count via `/unread-count`.',
    access: 'auth',
    query: NotificationValidation.listQuery,
  },
  NotificationController.getMine,
);

r.get(
  '/unread-count',
  { summary: 'Unread badge count', access: 'auth' },
  NotificationController.unreadCount,
);

r.patch(
  '/read-all',
  { summary: 'Mark all as read', access: 'auth' },
  NotificationController.markAllRead,
);

r.patch(
  '/:id/read',
  { summary: 'Mark one as read', access: 'auth', params: idParam },
  NotificationController.markRead,
);

r.delete(
  '/:id',
  { summary: 'Delete a notification', access: 'auth', params: idParam },
  NotificationController.remove,
);

export const notificationRoutes = r;
