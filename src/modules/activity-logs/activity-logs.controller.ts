import { createCrudController } from '@/shared/crud/crud.factory';
import { ActivityLogService } from './activity-logs.service';

export const ActivityLogController = createCrudController(ActivityLogService, {
  singular: 'Activity log',
  plural: 'Activity logs',
});
