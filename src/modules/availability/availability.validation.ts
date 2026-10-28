import { z } from 'zod';
import { DATE_REGEX } from '@/shared/utils/time';

export const AvailabilityValidation = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: z.object({
    date: z.string().regex(DATE_REGEX, 'Use YYYY-MM-DD'),
    staffId: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .describe('Only slots of this staff member'),
  }),
};

export type AvailabilityQuery = z.infer<typeof AvailabilityValidation.query>;
