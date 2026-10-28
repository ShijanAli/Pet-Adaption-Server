import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { activeStatusSchema, nonEmpty, slugSchema } from '@/shared/utils/validation';
import { PET_TYPE_SORTABLE_FIELDS } from './pet-types.constant';

const fields = {
  name: z.string().trim().min(2).max(50),
  slug: slugSchema.max(60).optional(),
  icon: z.string().trim().max(50).nullable().optional(),
  status: activeStatusSchema,
};

export const PetTypeValidation = {
  listQuery: listQuerySchema(
    PET_TYPE_SORTABLE_FIELDS,
    { status: activeStatusSchema.optional().describe('Admins only — public always sees active') },
    { sortBy: 'name', sortOrder: 'asc' },
  ),
  create: z.object({ ...fields, status: fields.status.default('active') }),
  update: nonEmpty(z.object(fields).partial().strict()),
};

export type ListPetTypesQuery = z.infer<typeof PetTypeValidation.listQuery>;
