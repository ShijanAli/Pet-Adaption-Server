import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { SYSTEM_ROLES } from '@/shared/constants/roles';
import type {
  CreateBlockedDateInput,
  ListBlockedDatesQuery,
  UpdateBlockedDateInput,
} from './blocked-dates.validation';

const crud = createCrudService({
  delegate: () => prisma.blockedDate,
  entityName: 'Blocked date',
  queryConfig: {
    searchableFields: ['reason'],
    filterableFields: ['staffId'],
    rangeFields: { from: ['date', 'gte'], to: ['date', 'lte'] },
  },
  include: { staff: { select: { id: true, firstName: true, lastName: true } } },
});

const assertNoDuplicate = async (staffId: number | null, date: Date, excludeId?: number) => {
  const exists = await prisma.blockedDate.findFirst({
    where: { staffId, date, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });
  if (exists) throw AppError.conflict('This date is already blocked');
};

export const BlockedDateService = {
  getAll({ scope, ...query }: ListBlockedDatesQuery) {
    const scopeWhere =
      scope === 'business'
        ? { staffId: null }
        : scope === 'staff'
          ? { staffId: { not: null } }
          : {};
    return crud.getAll(query, scopeWhere);
  },

  getById: crud.getById,

  async create(input: CreateBlockedDateInput) {
    if (input.staffId) {
      const staff = await prisma.user.findUnique({
        where: { id: input.staffId },
        select: { role: { select: { slug: true } } },
      });
      if (!staff || staff.role.slug === SYSTEM_ROLES.CUSTOMER) {
        throw AppError.badRequest('Staff member does not exist');
      }
    }
    await assertNoDuplicate(input.staffId, input.date);
    return crud.create(input);
  },

  async update(id: number, input: UpdateBlockedDateInput) {
    const existing = await prisma.blockedDate.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Blocked date');
    if (input.date) await assertNoDuplicate(existing.staffId, input.date, id);
    return crud.update(id, input);
  },

  remove: crud.remove,
};
