import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { BlockedDateController } from './blocked-dates.controller';
import { BlockedDateValidation } from './blocked-dates.validation';

const r = createModuleRouter(
  '/blocked-dates',
  'Blocked Dates',
  'Holidays / days off. `staffId: null` closes the whole business for that day.',
);

r.get(
  '/',
  {
    summary: 'List blocked dates',
    access: { permissions: [P.BLOCKED_DATE.VIEW] },
    query: BlockedDateValidation.listQuery,
  },
  BlockedDateController.getAll,
);

r.get(
  '/:id',
  {
    summary: 'Get a blocked date',
    access: { permissions: [P.BLOCKED_DATE.VIEW] },
    params: idParam,
  },
  BlockedDateController.getById,
);

r.post(
  '/',
  {
    summary: 'Block a date',
    access: { permissions: [P.BLOCKED_DATE.MANAGE] },
    body: BlockedDateValidation.create,
  },
  BlockedDateController.create,
);

r.patch(
  '/:id',
  {
    summary: 'Update a blocked date',
    access: { permissions: [P.BLOCKED_DATE.MANAGE] },
    params: idParam,
    body: BlockedDateValidation.update,
  },
  BlockedDateController.update,
);

r.delete(
  '/:id',
  { summary: 'Unblock a date', access: { permissions: [P.BLOCKED_DATE.MANAGE] }, params: idParam },
  BlockedDateController.remove,
);

export const blockedDateRoutes = r;
