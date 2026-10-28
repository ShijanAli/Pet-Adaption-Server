import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { booleanQuery, nonEmpty, urlSchema } from '@/shared/utils/validation';
import { DATE_REGEX, dateOnly, nowInBusinessTz } from '@/shared/utils/time';
import { PET_SORTABLE_FIELDS } from './pets.constant';

const gender = z.enum(['male', 'female']);
const size = z.enum(['small', 'medium', 'large']);

const dateOfBirth = z
  .string()
  .regex(DATE_REGEX, 'Use YYYY-MM-DD')
  .refine((d) => d <= nowInBusinessTz().date, 'Date of birth cannot be in the future')
  .transform(dateOnly);

const fields = {
  petTypeId: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  breed: z.string().trim().max(100).nullable().optional(),
  gender: gender.nullable().optional(),
  size: size.nullable().optional(),
  dateOfBirth: dateOfBirth.nullable().optional(),
  weightKg: z.number().positive().max(500).nullable().optional(),
  isVaccinated: z.boolean().optional(),
  photo: urlSchema.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
};

const commonFilters = {
  petTypeId: z.coerce.number().int().positive().optional(),
  size: size.optional(),
  gender: gender.optional(),
};

export const PetValidation = {
  myListQuery: listQuerySchema(PET_SORTABLE_FIELDS, commonFilters),

  adminListQuery: listQuerySchema(PET_SORTABLE_FIELDS, {
    ...commonFilters,
    userId: z.coerce.number().int().positive().optional(),
    isVaccinated: booleanQuery,
  }),

  create: z.object(fields),

  update: nonEmpty(z.object(fields).partial().strict()),
};

export type CreatePetInput = z.infer<typeof PetValidation.create>;
export type UpdatePetInput = z.infer<typeof PetValidation.update>;
export type PetListQuery = z.infer<typeof PetValidation.adminListQuery>;
