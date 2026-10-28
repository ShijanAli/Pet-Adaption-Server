import { prisma } from '@/lib/prisma';
import { createCrudService } from '@/shared/crud/crud.factory';
import type { ActivityLogListQuery } from './activity-logs.validation';

const crud = createCrudService({
  delegate: () => prisma.activityLog,
  entityName: 'Activity log',
  queryConfig: {
    searchableFields: ['modelType', 'user.email', 'user.firstName'],
    filterableFields: ['userId', 'modelType', 'modelId', 'action'],
    rangeFields: { from: ['createdAt', 'gte'], to: ['createdAt', 'lt'] },
  },
  include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
});

/** Read-only — rows are written automatically by the router (see activityLog.service) */
export const ActivityLogService = {
  getAll: (query: ActivityLogListQuery) => crud.getAll(query),
  getById: crud.getById,
};
