import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { DashboardController } from './dashboard.controller';
import { DashboardValidation } from './dashboard.validation';

const r = createModuleRouter('/dashboard', 'Dashboard', 'Admin home page numbers & charts (BDT)');
const access = { permissions: [P.DASHBOARD.VIEW] };

r.get(
  '/stats',
  { summary: 'Cards: users, bookings, revenue, adoption, reviews, inbox', access },
  DashboardController.getStats,
);

r.get(
  '/revenue',
  {
    summary: 'Net revenue chart',
    description:
      'Payments minus refunds per day or month (business timezone), split into bookings and adoption fees. Missing periods are filled with 0.',
    access,
    query: DashboardValidation.revenue,
  },
  DashboardController.getRevenue,
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
