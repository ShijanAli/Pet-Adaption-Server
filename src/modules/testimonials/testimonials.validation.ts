import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { activeStatusSchema, booleanQuery, nonEmpty, urlSchema } from '@/shared/utils/validation';

const fields = {
  name: z.string().trim().min(2).max(100),
  content: z.string().trim().min(10).max(2000),
  image: urlSchema.nullable().optional(),
  rating: z.number().int().min(1).max(5),
  isFeatured: z.boolean().optional(),
  status: activeStatusSchema,
  userId: z.number().int().positive().nullable().optional().describe('Link to a customer account'),
  adoptionId: z.number().int().positive().nullable().optional().describe('Adoption success story'),
};

export const TestimonialValidation = {
  listQuery: listQuerySchema(['createdAt', 'rating'] as const, {
    isFeatured: booleanQuery,
    rating: z.coerce.number().int().min(1).max(5).optional(),
    status: activeStatusSchema.optional().describe('Admins only'),
  }),
  create: z.object({
    ...fields,
    rating: fields.rating.default(5),
    status: fields.status.default('active'),
  }),
  update: nonEmpty(z.object(fields).partial().strict()),
};

export type TestimonialListQuery = z.infer<typeof TestimonialValidation.listQuery>;
export type TestimonialInput = Partial<z.infer<typeof TestimonialValidation.create>>;
