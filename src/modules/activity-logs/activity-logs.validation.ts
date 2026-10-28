import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { addDays } from '@/shared/utils/common';
import { DATE_REGEX, dateOnly } from '@/shared/utils/time';

const date = z.string().regex(DATE_REGEX, 'Use YYYY-MM-DD');

export const ActivityLogValidation = {
  listQuery: listQuerySchema(['createdAt'] as const, {
    userId: z.coerce.number().int().positive().optional(),
    modelType: z.string().trim().max(100).optional().describe('Module tag, e.g. Services'),
    modelId: z.coerce.number().int().positive().optional(),
    action: z.enum(['create', 'update', 'delete']).optional(),
    from: date.transform(dateOnly).optional(),
    to: date.transform((d) => addDays(dateOnly(d), 1)).optional(),
  }),
};

export type ActivityLogListQuery = z.infer<typeof ActivityLogValidation.listQuery>;
