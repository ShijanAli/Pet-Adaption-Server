import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { AvailabilityController } from './availability.controller';
import { AvailabilityValidation } from './availability.validation';

const r = createModuleRouter(
  '/services',
  'Availability',
  'Free booking slots per service and date',
);

r.get(
  '/:id/availability',
  {
    summary: 'Free time slots for a service on a date',
    description:
      'Times are in the business timezone. Each slot lists the staff members free at that time. ' +
      'Considers staff schedules, blocked dates, existing bookings, slot interval and advance-booking settings.',
    access: 'public',
    params: AvailabilityValidation.params,
    query: AvailabilityValidation.query,
  },
  AvailabilityController.getSlots,
);

export const availabilityRoutes = r;
