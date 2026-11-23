import { Prisma } from '@generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { SYSTEM_ROLES } from '@/shared/constants/roles';
import { round2, toNumber } from '@/shared/utils/money';
import { addDays } from '@/shared/utils/common';
import {
  dateOnly,
  nowInBusinessTz,
  previousMonthStart,
  startOfBusinessDay,
  startOfMonthString,
  toDateString,
} from '@/shared/utils/time';
import type { BookingValueQuery, RangeQuery, TopServicesQuery } from './dashboard.validation';

const OPEN_BOOKINGS = ['pending', 'confirmed', 'in_progress'] as const;

/**
 * Value (sum of booking totals, BDT) and count of completed bookings whose
 * booking date is in [from, to). Payment happens offline, so this is the
 * "work delivered" figure, not cash received.
 */
const completedValue = async (from?: Date, to?: Date) => {
  const bookingDate = { ...(from && { gte: from }), ...(to && { lt: to }) };
  const agg = await prisma.booking.aggregate({
    where: { status: 'completed', bookingDate },
    _sum: { totalAmount: true },
  });
  return round2(toNumber(agg._sum.totalAmount));
};
/** Every period between from and to, so charts have no gaps */
const periods = (from: string, to: string, groupBy: 'day' | 'month') => {
  const out: string[] = [];
  if (groupBy === 'day') {
    for (let d = dateOnly(from); d <= dateOnly(to); d = addDays(d, 1)) out.push(toDateString(d));
  } else {
    const d = dateOnly(startOfMonthString(from));
    while (d <= dateOnly(to)) {
      out.push(toDateString(d).slice(0, 7));
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  }
  return out;
};

export const DashboardService = {
  /** One call for all the cards on the admin home page */
  async getStats() {
    const today = nowInBusinessTz().date;
    const todayDate = dateOnly(today);
    const monthStart = startOfBusinessDay(startOfMonthString(today));
    const monthStartDate = dateOnly(startOfMonthString(today));
    const lastMonthStartDate = dateOnly(previousMonthStart(today));

    const [
      customers,
      staff,
      newCustomers,
      bookingsToday,
      upcomingBookings,
      pendingBookings,
      completedThisMonth,
      valueThisMonth,
      valueLastMonth,
      valueTotal,
      availablePets,
      pendingApplications,
      adoptionsInProgress,
      adoptionsCompletedThisMonth,
      pendingReviews,
      rating,
      newMessages,
      subscribers,
    ] = await Promise.all([
      prisma.user.count({ where: { role: { slug: SYSTEM_ROLES.CUSTOMER } } }),
      prisma.user.count({ where: { role: { slug: SYSTEM_ROLES.STAFF } } }),
      prisma.user.count({
        where: { role: { slug: SYSTEM_ROLES.CUSTOMER }, createdAt: { gte: monthStart } },
      }),
      prisma.booking.count({
        where: { bookingDate: todayDate, status: { in: [...OPEN_BOOKINGS] } },
      }),
      prisma.booking.count({
        where: { bookingDate: { gte: todayDate }, status: { in: [...OPEN_BOOKINGS] } },
      }),
      prisma.booking.count({ where: { status: 'pending' } }),
      prisma.booking.count({ where: { status: 'completed', bookingDate: { gte: monthStartDate } } }),
      completedValue(monthStartDate),
      completedValue(lastMonthStartDate, monthStartDate),
      completedValue(),
      prisma.adoptionPet.count({ where: { status: 'available' } }),
      prisma.adoptionApplication.count({ where: { status: { in: ['pending', 'under_review'] } } }),
      prisma.adoption.count({ where: { status: 'in_progress' } }),
      prisma.adoption.count({ where: { status: 'completed', completedAt: { gte: monthStart } } }),
      prisma.review.count({ where: { status: 'pending' } }),
      prisma.review.aggregate({ where: { status: 'approved' }, _avg: { rating: true } }),
      prisma.contactMessage.count({ where: { status: 'new' } }),
      prisma.newsletterSubscriber.count({ where: { status: 'subscribed' } }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      currency: 'BDT',
      users: { customers, staff, newCustomersThisMonth: newCustomers },
      bookings: {
        today: bookingsToday,
        upcoming: upcomingBookings,
        pending: pendingBookings,
        completedThisMonth,
      },
      bookingValue: {
        thisMonth: valueThisMonth,
        lastMonth: valueLastMonth,
        total: valueTotal,
        growthPercent:
          valueLastMonth > 0
            ? round2(((valueThisMonth - valueLastMonth) / valueLastMonth) * 100)
            : null,
      },
      adoption: {
        availablePets,
        pendingApplications,
        inProgress: adoptionsInProgress,
        completedThisMonth: adoptionsCompletedThisMonth,
      },
      reviews: {
        pending: pendingReviews,
        averageRating: Math.round((rating._avg.rating ?? 0) * 10) / 10,
      },
      inbox: { newMessages, subscribers },
    };
  },

  /** Completed bookings per day / month: count and value (BDT) */
  async getBookingValue({ from, to, groupBy }: BookingValueQuery) {
    // groupBy is validated by zod ('day' | 'month'), so Prisma.raw is safe here
    const unit = Prisma.raw(`'${groupBy}'`);
    const format = Prisma.raw(groupBy === 'day' ? `'YYYY-MM-DD'` : `'YYYY-MM'`);

    const rows = await prisma.$queryRaw<
      { period: string; completed: bigint; value: string | null }[]
    >`
      SELECT
        to_char(date_trunc(${unit}, booking_date), ${format}) AS period,
        COUNT(*) AS completed,
        SUM(total_amount) AS value
      FROM bookings
      WHERE status = 'completed'
        AND booking_date >= ${from}::date AND booking_date <= ${to}::date
      GROUP BY 1
      ORDER BY 1`;

    const byPeriod = new Map(rows.map((r) => [r.period, r]));
    const series = periods(from, to, groupBy).map((period) => {
      const row = byPeriod.get(period);
      return {
        period,
        completed: Number(row?.completed ?? 0),
        value: round2(toNumber(row?.value)),
      };
    });

    return {
      from,
      to,
      groupBy,
      currency: 'BDT',
      completed: series.reduce((sum, p) => sum + p.completed, 0),
      total: round2(series.reduce((sum, p) => sum + p.value, 0)),
      series,
    };
  },

  /** Most booked services (cancelled / no-show excluded) */
  async getTopServices({ from, to, limit }: TopServicesQuery) {
    const groups = await prisma.booking.groupBy({
      by: ['serviceId'],
      where: {
        bookingDate: { gte: dateOnly(from), lte: dateOnly(to) },
        status: { notIn: ['cancelled', 'no_show'] },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: limit,
    });
    const services = await prisma.service.findMany({
      where: { id: { in: groups.map((g) => g.serviceId) }, deletedAt: undefined },
      select: { id: true, name: true, slug: true, avgRating: true },
    });
    const byId = new Map(services.map((s) => [s.id, s]));
    return groups.map((g) => ({
      service: byId.get(g.serviceId) ?? { id: g.serviceId },
      bookings: g._count._all,
      bookedValue: round2(toNumber(g._sum.totalAmount)),
    }));
  },

  /** Booking counts per status (for a donut chart) */
  async getBookingsByStatus({ from, to }: RangeQuery) {
    const groups = await prisma.booking.groupBy({
      by: ['status'],
      where: { bookingDate: { gte: dateOnly(from), lte: dateOnly(to) } },
      _count: { _all: true },
    });
    const statuses = [
      'pending',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'no_show',
    ] as const;
    return Object.fromEntries(
      statuses.map((s) => [s, groups.find((g) => g.status === s)?._count._all ?? 0]),
    ) as Record<(typeof statuses)[number], number>;
  },
};
