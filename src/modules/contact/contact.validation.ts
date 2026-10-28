import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { emailSchema, phoneSchema } from '@/shared/utils/validation';

const status = z.enum(['new', 'read', 'replied']);

export const ContactValidation = {
  create: z.object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    phone: phoneSchema.optional(),
    subject: z.string().trim().min(3).max(200),
    message: z.string().trim().min(10).max(5000),
  }),

  listQuery: listQuerySchema(['createdAt'] as const, { status: status.optional() }),

  updateStatus: z.object({ status }),
};

export type ContactInput = z.infer<typeof ContactValidation.create>;
export type ContactListQuery = z.infer<typeof ContactValidation.listQuery>;
