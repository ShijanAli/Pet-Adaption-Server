import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { emailSchema } from '@/shared/utils/validation';

const status = z.enum(['subscribed', 'unsubscribed']);

export const NewsletterValidation = {
  subscribe: z.object({ email: emailSchema }),

  unsubscribe: z.object({
    email: emailSchema,
    token: z.string().trim().min(10).max(100).describe('From the unsubscribe link in emails'),
  }),

  listQuery: listQuerySchema(['subscribedAt', 'email'] as const, { status: status.optional() }),

  exportQuery: z.object({ status: status.default('subscribed') }),
};

export type SubscriberListQuery = z.infer<typeof NewsletterValidation.listQuery>;
