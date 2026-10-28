import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import {
  activeStatusSchema,
  booleanQuery,
  nonEmpty,
  slugSchema,
  urlSchema,
} from '@/shared/utils/validation';
import { CATEGORY_SORTABLE_FIELDS } from './service-categories.constant';

const fields = {
  parentId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(2).max(100),
  slug: slugSchema.max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  icon: z.string().trim().max(50).nullable().optional(),
  image: urlSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  status: activeStatusSchema,
};

export const CategoryValidation = {
  listQuery: listQuerySchema(
    CATEGORY_SORTABLE_FIELDS,
    {
      status: activeStatusSchema.optional().describe('Admins only — public always sees active'),
      parentId: z.coerce.number().int().positive().optional(),
      rootOnly: booleanQuery.describe('Only top-level categories'),
    },
    { sortBy: 'sortOrder', sortOrder: 'asc' },
  ),

  create: z.object({ ...fields, status: fields.status.default('active') }),

  update: nonEmpty(z.object(fields).partial().strict()),
};

export type ListCategoriesQuery = z.infer<typeof CategoryValidation.listQuery>;
export type CreateCategoryInput = z.infer<typeof CategoryValidation.create>;
export type UpdateCategoryInput = z.infer<typeof CategoryValidation.update>;
