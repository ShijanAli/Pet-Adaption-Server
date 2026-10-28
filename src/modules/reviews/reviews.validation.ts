import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { nonEmpty, urlSchema } from '@/shared/utils/validation';
import { MAX_REVIEW_IMAGES, REVIEW_SORTABLE_FIELDS } from './reviews.constant';

const rating = z.number().int().min(1).max(5);
const ratingFilter = z.coerce.number().int().min(1).max(5).optional();
const status = z.enum(['pending', 'approved', 'rejected']);

const content = {
  rating,
  title: z.string().trim().max(150).nullable().optional(),
  comment: z.string().trim().max(3000).nullable().optional(),
  images: z
    .array(urlSchema)
    .max(MAX_REVIEW_IMAGES)
    .optional()
    .describe('Upload with folder=reviews first'),
};

export const ReviewValidation = {
  create: z.object({ bookingId: z.number().int().positive(), ...content }),

  update: nonEmpty(z.object(content).partial().strict()),

  publicListQuery: listQuerySchema(REVIEW_SORTABLE_FIELDS, { rating: ratingFilter }),

  myListQuery: listQuerySchema(REVIEW_SORTABLE_FIELDS, {
    status: status.optional(),
    rating: ratingFilter,
    serviceId: z.coerce.number().int().positive().optional(),
  }),

  adminListQuery: listQuerySchema(REVIEW_SORTABLE_FIELDS, {
    status: status.optional(),
    rating: ratingFilter,
    serviceId: z.coerce.number().int().positive().optional(),
    userId: z.coerce.number().int().positive().optional(),
  }),

  moderate: z.object({ status: z.enum(['approved', 'rejected']) }),

  reply: z.object({
    reply: z.string().trim().min(2).max(2000).nullable().describe('null removes the reply'),
  }),

  serviceParam: z.object({ idOrSlug: z.string().trim().min(1).max(200) }),
};

export type CreateReviewInput = z.infer<typeof ReviewValidation.create>;
export type UpdateReviewInput = z.infer<typeof ReviewValidation.update>;
export type ReviewListQuery = z.infer<typeof ReviewValidation.adminListQuery>;
