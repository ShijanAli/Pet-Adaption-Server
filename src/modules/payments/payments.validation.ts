import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { addDays } from '@/shared/utils/common';
import { DATE_REGEX, dateOnly } from '@/shared/utils/time';
import { moneySchema } from '@/shared/utils/validation';
import { PAYMENT_SORTABLE_FIELDS } from './payments.constant';

const dateString = z.string().regex(DATE_REGEX, 'Use YYYY-MM-DD');

const filters = {
  status: z.enum(['pending', 'success', 'failed', 'cancelled', 'refunded']).optional(),
  type: z.enum(['payment', 'refund']).optional(),
  bookingId: z.coerce.number().int().positive().optional(),
  adoptionId: z.coerce.number().int().positive().optional(),
  from: dateString.transform(dateOnly).optional(),
  // inclusive end date → "< next day"
  to: dateString.transform((d) => addDays(dateOnly(d), 1)).optional(),
};

/** A payment is for exactly one booking or one adoption */
const exactlyOneTarget = (v: { bookingId?: number; adoptionId?: number }) =>
  Boolean(v.bookingId) !== Boolean(v.adoptionId);
const targetRule = { path: ['bookingId'], message: 'Send either bookingId or adoptionId' };

const target = {
  bookingId: z.number().int().positive().optional(),
  adoptionId: z.number().int().positive().optional().describe('Adoption fee payment'),
};

export const PaymentValidation = {
  cash: z
    .object({
      ...target,
      amount: moneySchema
        .refine((v) => v > 0, 'Amount must be greater than 0')
        .optional()
        .describe('BDT — defaults to the full due amount'),
      method: z.enum(['cash', 'card', 'mobile_banking']).default('cash'),
      note: z.string().trim().max(500).optional(),
    })
    .refine(exactlyOneTarget, targetRule),

  refund: z.object({
    amount: moneySchema
      .refine((v) => v > 0, 'Amount must be greater than 0')
      .optional()
      .describe('In the payment currency — defaults to everything refundable'),
    reason: z.string().trim().min(3).max(255),
  }),

  myListQuery: listQuerySchema(PAYMENT_SORTABLE_FIELDS, filters),

  adminListQuery: listQuerySchema(PAYMENT_SORTABLE_FIELDS, {
    ...filters,
    method: z.enum(['cash', 'card', 'mobile_banking']).optional(),
    currency: z.enum(['BDT', 'USD']).optional(),
    userId: z.coerce.number().int().positive().optional(),
  }),
};

export type CashPaymentInput = z.infer<typeof PaymentValidation.cash>;
export type RefundInput = z.infer<typeof PaymentValidation.refund>;
export type PaymentListQuery = z.infer<typeof PaymentValidation.adminListQuery>;
