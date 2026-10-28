import { z } from 'zod';
import { DATE_REGEX, diffInDays } from '@/shared/utils/time';

const date = z.string().regex(DATE_REGEX, 'Use YYYY-MM-DD');

const range = z
  .object({ from: date, to: date })
  .refine((v) => v.from <= v.to, { path: ['to'], message: '`to` must be on or after `from`' })
  .refine((v) => diffInDays(v.from, v.to) <= 731, {
    path: ['to'],
    message: 'Range can be at most 2 years',
  });

export const DashboardValidation = {
  revenue: z
    .object({ from: date, to: date, groupBy: z.enum(['day', 'month']).default('day') })
    .refine((v) => v.from <= v.to, { path: ['to'], message: '`to` must be on or after `from`' })
    .refine((v) => v.groupBy === 'month' || diffInDays(v.from, v.to) <= 366, {
      path: ['groupBy'],
      message: 'Use groupBy=month for ranges longer than a year',
    }),

  range,

  topServices: z.object({
    from: date,
    to: date,
    limit: z.coerce.number().int().min(1).max(50).default(5),
  }),
};

export type RevenueQuery = z.infer<typeof DashboardValidation.revenue>;
export type RangeQuery = z.infer<typeof DashboardValidation.range>;
export type TopServicesQuery = z.infer<typeof DashboardValidation.topServices>;
