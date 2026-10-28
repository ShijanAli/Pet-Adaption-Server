import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import {
  activeStatusSchema,
  booleanQuery,
  idArraySchema,
  moneySchema,
  nonEmpty,
  slugSchema,
  urlSchema,
} from '@/shared/utils/validation';
import { SERVICE_SORTABLE_FIELDS } from './services.constant';

const fields = {
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(2).max(150),
  slug: slugSchema.optional(),
  shortDescription: z.string().trim().max(255).nullable().optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  price: moneySchema,
  discountPrice: moneySchema.nullable().optional(),
  durationMinutes: z
    .number()
    .int()
    .min(5)
    .max(720)
    .multipleOf(5, 'Duration must be a multiple of 5'),
  icon: z.string().trim().max(50).nullable().optional(),
  image: urlSchema.nullable().optional(),
  status: activeStatusSchema,
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  maxPetsPerBooking: z.number().int().min(1).max(10).optional(),
  requiresVaccination: z.boolean().optional(),
  petTypeIds: idArraySchema(20).refine((ids) => ids.length > 0, 'Select at least one pet type'),
  staffIds: idArraySchema(100),
};

const discountBelowPrice = (v: { price?: number; discountPrice?: number | null }) =>
  v.price === undefined || v.discountPrice == null || v.discountPrice < v.price;

const discountRule = {
  path: ['discountPrice'],
  message: 'Discount price must be lower than the price',
};

export const ServiceValidation = {
  listQuery: listQuerySchema(
    SERVICE_SORTABLE_FIELDS,
    {
      categoryId: z.coerce.number().int().positive().optional(),
      category: z.string().trim().optional().describe('Category slug'),
      petTypeId: z.coerce.number().int().positive().optional(),
      petType: z.string().trim().optional().describe('Pet type slug, e.g. dog'),
      staffId: z.coerce.number().int().positive().optional(),
      isFeatured: booleanQuery,
      requiresVaccination: booleanQuery,
      minPrice: z.coerce.number().nonnegative().optional(),
      maxPrice: z.coerce.number().nonnegative().optional(),
      maxDuration: z.coerce.number().int().positive().optional(),
      status: activeStatusSchema.optional().describe('Admins only — public always sees active'),
    },
    { sortBy: 'sortOrder', sortOrder: 'asc' },
  ),

  create: z
    .object({
      ...fields,
      status: fields.status.default('active'),
      staffIds: fields.staffIds.default([]),
    })
    .refine(discountBelowPrice, discountRule),

  update: nonEmpty(z.object(fields).partial().strict()).refine(discountBelowPrice, discountRule),

  updateStatus: z.object({ status: activeStatusSchema }),

  setPetTypes: z.object({ petTypeIds: fields.petTypeIds }),

  setStaff: z.object({ staffIds: fields.staffIds }),
};

export type ListServicesQuery = z.infer<typeof ServiceValidation.listQuery>;
export type CreateServiceInput = z.infer<typeof ServiceValidation.create>;
export type UpdateServiceInput = z.infer<typeof ServiceValidation.update>;
