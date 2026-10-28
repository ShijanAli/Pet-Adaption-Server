import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export const PAYMENT_SORTABLE_FIELDS = ['createdAt', 'amount', 'paidAt'] as const;

/** Bookings in these states can receive a payment */
export const PAYABLE_BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'in_progress',
  'completed',
] as const;

/** SSLCommerz validation statuses that mean "money received" */
export const GATEWAY_VALID_STATUSES = ['VALID', 'VALIDATED'];

export const paymentInclude = {
  booking: { select: { id: true, bookingNo: true, status: true, totalAmount: true } },
  adoption: {
    select: {
      id: true,
      status: true,
      feeAmount: true,
      application: { select: { applicationNo: true } },
    },
  },
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  refundOf: { select: { id: true, transactionId: true, amount: true, currency: true } },
  refunds: {
    select: { id: true, transactionId: true, amount: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

/** Customers never see raw gateway payloads */
export const myPaymentOmit = { gatewayResponse: true, valId: true } as const;

const range: QueryBuilderConfig['rangeFields'] = {
  from: ['createdAt', 'gte'],
  to: ['createdAt', 'lt'],
};

export const myPaymentQueryConfig: QueryBuilderConfig = {
  searchableFields: ['transactionId', 'booking.bookingNo'],
  filterableFields: ['status', 'type', 'bookingId', 'adoptionId'],
  rangeFields: range,
};

export const adminPaymentQueryConfig: QueryBuilderConfig = {
  searchableFields: [
    'transactionId',
    'bankTranId',
    'booking.bookingNo',
    'adoption.application.applicationNo',
    'user.email',
  ],
  filterableFields: ['status', 'type', 'method', 'currency', 'bookingId', 'adoptionId', 'userId'],
  rangeFields: range,
};
