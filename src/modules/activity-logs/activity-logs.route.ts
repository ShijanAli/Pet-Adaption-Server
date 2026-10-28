import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { ActivityLogController } from './activity-logs.controller';
import { ActivityLogValidation } from './activity-logs.validation';

const r = createModuleRouter(
  '/activity-logs',
  'Activity Logs',
  'Audit trail: every successful admin create / update / delete is recorded automatically',
);

r.get(
  '/',
  {
    summary: 'List activity logs',
    access: { permissions: [P.ACTIVITY_LOG.VIEW] },
    query: ActivityLogValidation.listQuery,
  },
  ActivityLogController.getAll,
);

r.get(
  '/:id',
  {
    summary: 'Activity log detail',
    access: { permissions: [P.ACTIVITY_LOG.VIEW] },
    params: idParam,
  },
  ActivityLogController.getById,
);

export const activityLogRoutes = r;
