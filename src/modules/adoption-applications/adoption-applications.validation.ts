import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { booleanQuery } from '@/shared/utils/validation';
import { APPLICATION_SORTABLE_FIELDS } from './adoption-applications.constant';

const status = z.enum(['pending', 'under_review', 'approved', 'rejected', 'cancelled']);

const filters = {
  status: status.optional(),
  adoptionPetId: z.coerce.number().int().positive().optional(),
};

export const ApplicationValidation = {
  create: z
    .object({
      adoptionPetId: z.number().int().positive(),
      homeType: z.enum(['house', 'apartment']),
      hasYard: z.boolean().default(false),
      hasOtherPets: z.boolean().default(false),
      otherPetsDetails: z.string().trim().max(1000).optional(),
      hasChildren: z.boolean().default(false),
      experience: z.string().trim().max(2000).optional(),
      reason: z.string().trim().min(20, 'Tell us a bit more (at least 20 characters)').max(3000),
    })
    .refine((v) => !v.hasOtherPets || Boolean(v.otherPetsDetails), {
      path: ['otherPetsDetails'],
      message: 'Tell us about your other pets',
    }),

  myListQuery: listQuerySchema(APPLICATION_SORTABLE_FIELDS, filters),

  adminListQuery: listQuerySchema(APPLICATION_SORTABLE_FIELDS, {
    ...filters,
    userId: z.coerce.number().int().positive().optional(),
    homeType: z.enum(['house', 'apartment']).optional(),
    hasChildren: booleanQuery,
    hasOtherPets: booleanQuery,
  }),

  idOrNoParam: z.object({
    idOrNo: z.string().trim().min(1).max(30).describe('Application id or application number'),
  }),

  cancel: z.object({ reason: z.string().trim().max(500).optional() }),

  review: z.object({
    status: z.enum(['under_review', 'approved', 'rejected']),
    adminNote: z.string().trim().max(1000).optional(),
  }),
};

export type CreateApplicationInput = z.infer<typeof ApplicationValidation.create>;
export type ApplicationListQuery = z.infer<typeof ApplicationValidation.adminListQuery>;
export type ReviewInput = z.infer<typeof ApplicationValidation.review>;
