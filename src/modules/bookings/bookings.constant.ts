import type { BookingStatus } from '@generated/prisma/client';
import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export { OPEN_BOOKING_STATUSES } from '@/modules/services/services.constant';

export const BOOKING_SORTABLE_FIELDS = [
  'createdAt',
  'bookingDate',
  'totalAmount',
  'status',
] as const;

/** Allowed status changes (admin / staff side) */
export const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

/** Customers can cancel only these */
export const CUSTOMER_CANCELLABLE: BookingStatus[] = ['pending', 'confirmed'];

/** Status changes that trigger an email to the customer */
export const NOTIFY_STATUSES: BookingStatus[] = ['confirmed', 'completed', 'cancelled', 'no_show'];

export const bookingInclude = {
  service: { select: { id: true, name: true, slug: true, durationMinutes: true, image: true } },
  pet: {
    select: {
      id: true,
      name: true,
      photo: true,
      petType: { select: { id: true, name: true, slug: true } },
    },
  },
  assignedStaff: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
  promotion: { select: { id: true, code: true, title: true } },
  address: true,
} as const;

export const adminBookingInclude = {
  ...bookingInclude,
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
} as const;

export const bookingDetailInclude = {
  ...adminBookingInclude,
  statusLogs: {
    orderBy: { createdAt: 'asc' as const },
    include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
  },
  payments: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      type: true,
      method: true,
      status: true,
      amount: true,
      currency: true,
      baseAmount: true,
      transactionId: true,
      paidAt: true,
      createdAt: true,
    },
  },
} as const;

const dateRange: QueryBuilderConfig['rangeFields'] = {
  from: ['bookingDate', 'gte'],
  to: ['bookingDate', 'lte'],
};

export const myBookingQueryConfig: QueryBuilderConfig = {
  searchableFields: ['bookingNo', 'service.name', 'pet.name'],
  filterableFields: ['status', 'paymentStatus', 'petId', 'serviceId'],
  rangeFields: dateRange,
};

export const adminBookingQueryConfig: QueryBuilderConfig = {
  searchableFields: ['bookingNo', 'user.email', 'user.firstName', 'user.lastName', 'pet.name'],
  filterableFields: {
    status: 'status',
    paymentStatus: 'paymentStatus',
    serviceId: 'serviceId',
    staffId: 'assignedStaffId',
    userId: 'userId',
  },
  rangeFields: dateRange,
};
