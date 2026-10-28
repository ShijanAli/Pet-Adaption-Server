import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { activeStatusSchema, booleanQuery, nonEmpty } from '@/shared/utils/validation';

const fields = {
  question: z.string().trim().min(5).max(255),
  answer: z.string().trim().min(2).max(5000),
  category: z
    .string()
    .trim()
    .max(50)
    .nullable()
    .optional()
    .describe('e.g. adoption, booking, payment'),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  status: activeStatusSchema,
};

export const FaqValidation = {
  listQuery: listQuerySchema(
    ['sortOrder', 'createdAt'] as const,
    {
      category: z.string().trim().max(50).optional(),
      grouped: booleanQuery.describe('Group by category (no pagination)'),
      status: activeStatusSchema.optional().describe('Admins only'),
    },
    { sortBy: 'sortOrder', sortOrder: 'asc' },
  ),
  create: z.object({ ...fields, status: fields.status.default('active') }),
  update: nonEmpty(z.object(fields).partial().strict()),
};

export type FaqListQuery = z.infer<typeof FaqValidation.listQuery>;
