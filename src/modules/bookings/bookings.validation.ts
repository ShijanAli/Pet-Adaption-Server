import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { DATE_REGEX, TIME_REGEX, dateOnly } from '@/shared/utils/time';
import { promoCodeSchema } from '@/modules/promotions/promotions.validation';
import { BOOKING_SORTABLE_FIELDS } from './bookings.constant';

const bookingStatus = z.enum([
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
]);
const paymentStatus = z.enum(['unpaid', 'partial', 'paid', 'refunded']);
const dateFilter = z.string().regex(DATE_REGEX, 'Use YYYY-MM-DD').transform(dateOnly);

const commonFilters = {
  status: bookingStatus.optional(),
  paymentStatus: paymentStatus.optional(),
  serviceId: z.coerce.number().int().positive().optional(),
  from: dateFilter.optional(),
  to: dateFilter.optional(),
};

export const BookingValidation = {
  create: z.object({
    serviceId: z.number().int().positive(),
    petId: z.number().int().positive(),
    date: z.string().regex(DATE_REGEX, 'Use YYYY-MM-DD'),
    startTime: z.string().regex(TIME_REGEX, 'Use 24h HH:mm'),
    staffId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Preferred staff — any free staff when omitted'),
    addressId: z.number().int().positive().optional().describe('For home visit services'),
    promoCode: promoCodeSchema.optional(),
    customerNote: z.string().trim().max(1000).optional(),
  }),

  myListQuery: listQuerySchema(BOOKING_SORTABLE_FIELDS, {
    ...commonFilters,
    petId: z.coerce.number().int().positive().optional(),
  }),

  adminListQuery: listQuerySchema(BOOKING_SORTABLE_FIELDS, {
    ...commonFilters,
    staffId: z.coerce.number().int().positive().optional(),
    userId: z.coerce.number().int().positive().optional(),
  }),

  staffListQuery: listQuerySchema(BOOKING_SORTABLE_FIELDS, commonFilters, {
    sortBy: 'bookingDate',
    sortOrder: 'asc',
  }),

  idOrNoParam: z.object({
    idOrNo: z.string().trim().min(1).max(30).describe('Booking id or booking number'),
  }),

  cancel: z.object({ reason: z.string().trim().max(500).optional() }),

  updateStatus: z.object({
    status: bookingStatus.exclude(['pending']),
    note: z.string().trim().max(500).optional(),
  }),

  assignStaff: z.object({ staffId: z.number().int().positive() }),
};

export type CreateBookingInput = z.infer<typeof BookingValidation.create>;
export type BookingListQuery = z.infer<typeof BookingValidation.adminListQuery>;
