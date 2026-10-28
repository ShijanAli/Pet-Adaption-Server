import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import {
  activeStatusSchema,
  booleanQuery,
  idArraySchema,
  moneySchema,
  urlSchema,
} from '@/shared/utils/validation';
import { PROMOTION_SORTABLE_FIELDS } from './promotions.constant';

export const promoCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,50}$/, 'Code: 3-50 letters, numbers, - or _');

const fields = {
  title: z.string().trim().min(2).max(150),
  code: promoCodeSchema,
  description: z.string().trim().max(2000).nullable().optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: moneySchema.refine((v) => v > 0, 'Discount must be greater than 0'),
  maxDiscountAmount: moneySchema.nullable().optional(),
  minOrderAmount: moneySchema.nullable().optional(),
  appliesTo: z.enum(['all', 'specific_services', 'specific_categories']),
  serviceIds: idArraySchema(200),
  categoryIds: idArraySchema(100),
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().max(100),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  bannerImage: urlSchema.nullable().optional(),
  status: activeStatusSchema,
};

type Shape = {
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  startsAt?: Date;
  endsAt?: Date;
  appliesTo?: string;
  serviceIds?: number[];
  categoryIds?: number[];
};

/** Rules that only make sense when the related fields are sent together */
const crossFieldRules = (v: Shape, ctx: z.RefinementCtx) => {
  if (v.discountType === 'percentage' && v.discountValue !== undefined && v.discountValue > 100) {
    ctx.addIssue({
      code: 'custom',
      path: ['discountValue'],
      message: 'Percentage cannot exceed 100',
    });
  }
  if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['endsAt'],
      message: 'End date must be after the start date',
    });
  }
  if (v.appliesTo === 'specific_services' && v.serviceIds && !v.serviceIds.length) {
    ctx.addIssue({ code: 'custom', path: ['serviceIds'], message: 'Select at least one service' });
  }
  if (v.appliesTo === 'specific_categories' && v.categoryIds && !v.categoryIds.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['categoryIds'],
      message: 'Select at least one category',
    });
  }
};

export const PromotionValidation = {
  listQuery: listQuerySchema(PROMOTION_SORTABLE_FIELDS, {
    status: activeStatusSchema.optional(),
    discountType: fields.discountType.optional(),
    appliesTo: fields.appliesTo.optional(),
    runningNow: booleanQuery.describe('Only promotions valid right now'),
  }),

  create: z
    .object({
      ...fields,
      appliesTo: fields.appliesTo.default('all'),
      serviceIds: fields.serviceIds.default([]),
      categoryIds: fields.categoryIds.default([]),
      perUserLimit: fields.perUserLimit.default(1),
      status: fields.status.default('active'),
    })
    .superRefine(crossFieldRules),

  update: z
    .object(fields)
    .partial()
    .strict()
    .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update')
    .superRefine(crossFieldRules),

  validateCode: z.object({
    code: promoCodeSchema,
    serviceId: z.number().int().positive(),
  }),
};

export type ListPromotionsQuery = z.infer<typeof PromotionValidation.listQuery>;
export type CreatePromotionInput = z.infer<typeof PromotionValidation.create>;
export type UpdatePromotionInput = z.infer<typeof PromotionValidation.update>;
