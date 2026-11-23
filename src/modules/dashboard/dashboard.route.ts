import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { DashboardController } from './dashboard.controller';
import { DashboardValidation } from './dashboard.validation';

const r = createModuleRouter('/dashboard', 'Dashboard', 'Admin home page numbers & charts (BDT)');
const access = { permissions: [P.DASHBOARD.VIEW] };

r.get(
  '/stats',
  { summary: 'Cards: users, bookings, booking value, adoption, reviews, inbox', access },
  DashboardController.getStats,
);

r.get(
  '/booking-value',
  {
    summary: 'Completed bookings chart',
    description:
      'Count and value (sum of booking totals, BDT) of completed bookings per day or month, by booking date. Missing periods are filled with 0.',
    access,
    query: DashboardValidation.bookingValue,
  },
  DashboardController.getBookingValue,
);

r.get(
  '/top-services',
  { summary: 'Most booked services', access, query: DashboardValidation.topServices },
  DashboardController.getTopServices,
);

r.get(
  '/bookings-by-status',
  { summary: 'Booking count per status', access, query: DashboardValidation.range },
  DashboardController.getBookingsByStatus,
);

export const dashboardRoutes = r;
