import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { settingsService } from '@/shared/services/settings.service';
import {
  dateOnly,
  dayOfWeek,
  diffInDays,
  minutesToTime,
  nowInBusinessTz,
  rangesOverlap,
  timeToMinutes,
} from '@/shared/utils/time';
import { OPEN_BOOKING_STATUSES } from '@/modules/services/services.constant';

export type SlotStaff = {
  id: number;
  firstName: string;
  lastName: string;
  profilePhoto: string | null;
};
export type Slot = { startTime: string; endTime: string; staff: SlotStaff[] };

type Params = {
  serviceId: number;
  date: string; // YYYY-MM-DD in the business timezone
  staffId?: number;
  /** ignore this booking when checking overlaps (rescheduling) */
  excludeBookingId?: number;
};

/**
 * Free time slots for a service on a date.
 *
 * A slot is free for a staff member when:
 *  - the business and the staff member are not blocked that day
 *  - the staff member provides the service and works that weekday
 *  - [start, start + duration) fits inside the working hours
 *  - it does not overlap any of their open bookings
 *  - (today) it starts in the future
 */
export const AvailabilityService = {
  async getSlots({ serviceId, date, staffId, excludeBookingId }: Params) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, status: 'active', category: { status: 'active', deletedAt: null } },
      select: { id: true, name: true, durationMinutes: true },
    });
    if (!service) throw AppError.notFound('Service');

    const now = nowInBusinessTz();
    if (date < now.date) throw AppError.badRequest('Date is in the past');

    const [advanceDays, interval] = await Promise.all([
      settingsService.getNumber('booking_advance_days'),
      settingsService.getNumber('booking_slot_interval_minutes'),
    ]);
    if (diffInDays(now.date, date) > advanceDays) {
      throw AppError.badRequest(`Bookings can be made up to ${advanceDays} days in advance`);
    }

    const base = { date, timezone: env.BUSINESS_TIMEZONE, service };
    const day = dayOfWeek(date);
    const dateValue = dateOnly(date);

    const closed = await prisma.blockedDate.findFirst({
      where: { date: dateValue, staffId: null },
    });
    if (closed) return { ...base, closed: true, reason: closed.reason, slots: [] as Slot[] };

    const staff = await prisma.user.findMany({
      where: {
        ...(staffId && { id: staffId }),
        status: 'active',
        role: { status: 'active' },
        staffServices: { some: { serviceId } },
        staffSchedules: { some: { dayOfWeek: day, isActive: true } },
        blockedDates: { none: { date: dateValue } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePhoto: true,
        staffSchedules: { where: { dayOfWeek: day, isActive: true }, take: 1 },
      },
      orderBy: { firstName: 'asc' },
    });

    const bookings = staff.length
      ? await prisma.booking.findMany({
          where: {
            assignedStaffId: { in: staff.map((s) => s.id) },
            bookingDate: dateValue,
            status: { in: [...OPEN_BOOKING_STATUSES] },
            ...(excludeBookingId && { NOT: { id: excludeBookingId } }),
          },
          select: { assignedStaffId: true, startTime: true, endTime: true },
        })
      : [];

    const slots = new Map<number, Slot>();

    for (const { staffSchedules, ...member } of staff) {
      const schedule = staffSchedules[0];
      const workStart = timeToMinutes(schedule.startTime);
      const workEnd = timeToMinutes(schedule.endTime);
      const busy = bookings
        .filter((b) => b.assignedStaffId === member.id)
        .map((b) => [timeToMinutes(b.startTime), timeToMinutes(b.endTime)] as const);

      for (let start = workStart; start + service.durationMinutes <= workEnd; start += interval) {
        const end = start + service.durationMinutes;
        if (date === now.date && start <= now.minutes) continue;
        if (busy.some(([bs, be]) => rangesOverlap(start, end, bs, be))) continue;

        const slot = slots.get(start) ?? {
          startTime: minutesToTime(start),
          endTime: minutesToTime(end),
          staff: [],
        };
        slot.staff.push(member);
        slots.set(start, slot);
      }
    }

    return {
      ...base,
      closed: false,
      reason: null,
      slots: [...slots.entries()].sort(([a], [b]) => a - b).map(([, s]) => s),
    };
  },

  /** Staff members free for an exact start time (used when creating a booking) */
  async getFreeStaffAt(params: Params & { startTime: string }) {
    const { slots } = await AvailabilityService.getSlots(params);
    return slots.find((s) => s.startTime === params.startTime)?.staff ?? [];
  },
};
