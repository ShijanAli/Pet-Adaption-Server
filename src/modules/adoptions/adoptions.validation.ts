import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { nonEmpty, urlSchema } from '@/shared/utils/validation';
import { DATE_REGEX, dateOnly } from '@/shared/utils/time';
import { ADOPTION_SORTABLE_FIELDS } from './adoptions.constant';

const date = z.string().regex(DATE_REGEX, 'Use YYYY-MM-DD').transform(dateOnly);

const filters = {
  status: z.enum(['in_progress', 'completed', 'cancelled']).optional(),
  from: date.optional(),
  to: date.optional(),
};

export const AdoptionValidation = {
  myListQuery: listQuerySchema(ADOPTION_SORTABLE_FIELDS, filters),

  adminListQuery: listQuerySchema(ADOPTION_SORTABLE_FIELDS, {
    ...filters,
    userId: z.coerce.number().int().positive().optional(),
    adoptionPetId: z.coerce.number().int().positive().optional(),
  }),

  update: nonEmpty(
    z
      .object({
        adoptionDate: date,
        contractFile: urlSchema.nullable(),
        followUpDate: date.nullable(),
      })
      .partial()
      .strict(),
  ),

  complete: z.object({
    adoptionDate: date.optional().describe('Handover date — defaults to today'),
    contractFile: urlSchema.optional(),
    followUpDate: date.optional(),
  }),

  cancel: z.object({ reason: z.string().trim().min(3).max(500) }),
};

export type AdoptionListQuery = z.infer<typeof AdoptionValidation.adminListQuery>;
export type UpdateAdoptionInput = z.infer<typeof AdoptionValidation.update>;
export type CompleteAdoptionInput = z.infer<typeof AdoptionValidation.complete>;
