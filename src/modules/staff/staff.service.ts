import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { SYSTEM_ROLES } from '@/shared/constants/roles';
import { buildListQuery, buildMeta } from '@/shared/utils/queryBuilder';
import { nowInBusinessTz, dateOnly } from '@/shared/utils/time';
import type { ListStaffQuery, ScheduleInput } from './staff.validation';

const scheduleOrder = { dayOfWeek: 'asc' } as const;

/** A schedule can be set for anyone who is not a customer */
const getProviderOrThrow = async (staffId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: staffId },
    select: { id: true, firstName: true, lastName: true, role: { select: { slug: true } } },
  });
  if (!user || user.role.slug === SYSTEM_ROLES.CUSTOMER) throw AppError.notFound('Staff member');
  return user;
};

export const StaffService = {
  /** Users with the `staff` role + the services they provide + weekly schedule */
  async getAll(query: ListStaffQuery) {
    const q = buildListQuery(query, {
      searchableFields: ['firstName', 'lastName', 'email', 'phone'],
      baseWhere: {
        role: { slug: SYSTEM_ROLES.STAFF },
        ...(query.serviceId && { staffServices: { some: { serviceId: query.serviceId } } }),
      },
    });

    const [data, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: q.where,
        orderBy: q.orderBy,
        skip: q.skip,
        take: q.take,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          profilePhoto: true,
          status: true,
          staffServices: {
            where: { service: { deletedAt: null } },
            select: { service: { select: { id: true, name: true, slug: true } } },
          },
          staffSchedules: { orderBy: scheduleOrder },
        },
      }),
      prisma.user.count({ where: q.where }),
    ]);

    return {
      data: data.map(({ staffServices, staffSchedules, ...u }) => ({
        ...u,
        services: staffServices.map((s) => s.service),
        schedules: staffSchedules,
      })),
      meta: buildMeta(total, q.page, q.limit),
    };
  },

  async getSchedules(staffId: number) {
    const staff = await getProviderOrThrow(staffId);
    const [schedules, upcomingBlockedDates] = await Promise.all([
      prisma.staffSchedule.findMany({ where: { staffId }, orderBy: scheduleOrder }),
      prisma.blockedDate.findMany({
        where: {
          OR: [{ staffId }, { staffId: null }],
          date: { gte: dateOnly(nowInBusinessTz().date) },
        },
        orderBy: { date: 'asc' },
        take: 30,
      }),
    ]);
    return { staff, schedules, upcomingBlockedDates };
  },

  /** Replaces the whole weekly schedule (days not sent = day off) */
  async setSchedules(staffId: number, schedules: ScheduleInput) {
    await getProviderOrThrow(staffId);
    await prisma.$transaction([
      prisma.staffSchedule.deleteMany({ where: { staffId } }),
      prisma.staffSchedule.createMany({ data: schedules.map((s) => ({ ...s, staffId })) }),
    ]);
    return StaffService.getSchedules(staffId);
  },
};
