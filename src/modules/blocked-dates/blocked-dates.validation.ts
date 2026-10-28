import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { nonEmpty } from '@/shared/utils/validation';
import { DATE_REGEX, dateOnly, nowInBusinessTz } from '@/shared/utils/time';

const dateString = z.string().regex(DATE_REGEX, 'Use YYYY-MM-DD');

const futureDate = dateString
  .refine((d) => d >= nowInBusinessTz().date, 'Date cannot be in the past')
  .transform(dateOnly);

export const BlockedDateValidation = {
  listQuery: listQuerySchema(
    ['date', 'createdAt'] as const,
    {
      staffId: z.coerce.number().int().positive().optional(),
      scope: z.enum(['business', 'staff']).optional().describe('business = whole shop closed'),
      from: dateString.transform(dateOnly).optional(),
      to: dateString.transform(dateOnly).optional(),
    },
    { sortBy: 'date', sortOrder: 'asc' },
  ),

  create: z.object({
    staffId: z
      .number()
      .int()
      .positive()
      .nullable()
      .default(null)
      .describe('null = whole business closed'),
    date: futureDate,
    reason: z.string().trim().max(255).nullable().optional(),
  }),

  update: nonEmpty(
    z
      .object({
        date: futureDate,
        reason: z.string().trim().max(255).nullable(),
      })
      .partial()
      .strict(),
  ),
};

export type ListBlockedDatesQuery = z.infer<typeof BlockedDateValidation.listQuery>;
export type CreateBlockedDateInput = z.infer<typeof BlockedDateValidation.create>;
export type UpdateBlockedDateInput = z.infer<typeof BlockedDateValidation.update>;
