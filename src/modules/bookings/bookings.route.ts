import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { BookingController } from './bookings.controller';
import { BookingValidation } from './bookings.validation';

/* ───────── Customer: /bookings (create) + /me/bookings ───────── */
const bookings = createModuleRouter('/bookings', 'Bookings', 'Service bookings');

bookings.post(
  '/',
  {
    summary: 'Book a service',
    description:
      'Pick a free slot from `GET /services/:id/availability`. The least busy free staff member is assigned ' +
      'unless `staffId` is given. Status starts as `pending` and becomes `confirmed` after payment ' +
      '(or when an admin confirms it).',
    access: 'auth',
    body: BookingValidation.create,
  },
  BookingController.create,
);

bookings.get(
  '/',
  {
    summary: 'List all bookings',
    description:
      'Search: booking no, customer email / name, pet name. Filters: status, paymentStatus, serviceId, staffId, userId, from, to.',
    access: { permissions: [P.BOOKING.VIEW] },
    query: BookingValidation.adminListQuery,
  },
  BookingController.getAll,
);

bookings.get(
  '/:id',
  {
    summary: 'Booking detail with history and payments',
    access: { permissions: [P.BOOKING.VIEW] },
    params: idParam,
  },
  BookingController.getById,
);

bookings.get(
  '/:id/logs',
  { summary: 'Booking status history', access: { permissions: [P.BOOKING.VIEW] }, params: idParam },
  BookingController.getLogs,
);

bookings.patch(
  '/:id/status',
  {
    summary: 'Change booking status',
    description:
      'pending → confirmed | cancelled · confirmed → in_progress | cancelled | no_show · in_progress → completed. ' +
      'Staff without `booking.assign_staff` can only update bookings assigned to them.',
    access: { permissions: [P.BOOKING.UPDATE_STATUS] },
    params: idParam,
    body: BookingValidation.updateStatus,
  },
  BookingController.updateStatus,
);

bookings.patch(
  '/:id/assign-staff',
  {
    summary: 'Assign / change the staff member',
    description: 'The new staff member must provide the service and be free at that time.',
    access: { permissions: [P.BOOKING.ASSIGN_STAFF] },
    params: idParam,
    body: BookingValidation.assignStaff,
  },
  BookingController.assignStaff,
);

const me = createModuleRouter('/me/bookings', 'My Bookings', "The logged-in customer's bookings");

me.get(
  '/',
  { summary: 'List my bookings', access: 'auth', query: BookingValidation.myListQuery },
  BookingController.getMine,
);

me.get(
  '/:idOrNo',
  {
    summary: 'Get my booking by id or booking number',
    access: 'auth',
    params: BookingValidation.idOrNoParam,
  },
  BookingController.getMineOne,
);

me.patch(
  '/:idOrNo/cancel',
  {
    summary: 'Cancel my booking',
    description:
      'Only pending / confirmed bookings, and at least `booking_cancel_before_hours` (setting) before the start.',
    access: 'auth',
    params: BookingValidation.idOrNoParam,
    body: BookingValidation.cancel,
  },
  BookingController.cancelMine,
);

const staff = createModuleRouter(
  '/staff/me/bookings',
  'My Bookings',
  "The logged-in staff member's assigned bookings",
);

staff.get(
  '/',
  {
    summary: 'Bookings assigned to me (staff)',
    access: 'auth',
    query: BookingValidation.staffListQuery,
  },
  BookingController.getAssigned,
);

export const bookingRoutes = bookings;
export const myBookingRoutes = me;
export const staffBookingRoutes = staff;
