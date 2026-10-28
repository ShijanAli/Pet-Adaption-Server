import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { StaffController } from './staff.controller';
import { StaffValidation } from './staff.validation';

const r = createModuleRouter('/staff', 'Staff', 'Service providers and their weekly working hours');

r.get(
  '/',
  {
    summary: 'List staff with their services and schedule',
    access: { permissions: [P.STAFF_SCHEDULE.VIEW] },
    query: StaffValidation.listQuery,
  },
  StaffController.getAll,
);

// declared before /:id so "me" is not parsed as an id
r.get(
  '/me/schedule',
  { summary: 'My weekly schedule + upcoming days off (for staff)', access: 'auth' },
  StaffController.getMySchedule,
);

r.get(
  '/:id/schedules',
  {
    summary: 'Get the weekly schedule of a staff member',
    access: { permissions: [P.STAFF_SCHEDULE.VIEW] },
    params: idParam,
  },
  StaffController.getSchedules,
);

r.put(
  '/:id/schedules',
  {
    summary: 'Replace the weekly schedule of a staff member',
    description:
      'Days that are not sent are treated as days off. Times are in the business timezone.',
    access: { permissions: [P.STAFF_SCHEDULE.MANAGE] },
    params: idParam,
    body: StaffValidation.setSchedules,
  },
  StaffController.setSchedules,
);

export const staffRoutes = r;
