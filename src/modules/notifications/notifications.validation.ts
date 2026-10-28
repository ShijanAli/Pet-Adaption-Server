import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { booleanQuery } from '@/shared/utils/validation';

export const NotificationValidation = {
  listQuery: listQuerySchema(['createdAt'] as const, {
    unread: booleanQuery.describe('true = only unread'),
    type: z.string().trim().max(100).optional().describe('e.g. booking.confirmed'),
  }),
};

export type NotificationListQuery = z.infer<typeof NotificationValidation.listQuery>;
