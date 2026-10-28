import type { Request, Response } from 'express';
import { sendResponse } from '@/shared/utils/sendResponse';
import { NotificationService } from './notifications.service';
import type { NotificationListQuery } from './notifications.validation';

const id = (req: Request) => Number(req.params.id);

export const NotificationController = {
  async getMine(req: Request, res: Response) {
    const { data, meta } = await NotificationService.getMine(
      req.user!.id,
      req.query as unknown as NotificationListQuery,
    );
    sendResponse(res, { message: 'Notifications retrieved successfully', data, meta });
  },

  async unreadCount(req: Request, res: Response) {
    const count = await NotificationService.unreadCount(req.user!.id);
    sendResponse(res, { message: 'Unread count retrieved', data: { count } });
  },

  async markRead(req: Request, res: Response) {
    await NotificationService.markRead(req.user!.id, id(req));
    sendResponse(res, { message: 'Notification marked as read' });
  },

  async markAllRead(req: Request, res: Response) {
    const data = await NotificationService.markAllRead(req.user!.id);
    sendResponse(res, { message: 'All notifications marked as read', data });
  },

  async remove(req: Request, res: Response) {
    await NotificationService.remove(req.user!.id, id(req));
    sendResponse(res, { message: 'Notification deleted' });
  },
};
