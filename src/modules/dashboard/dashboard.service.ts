import { Prisma } from '@generated/prisma/client';
import { env } from '@/config/env';
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
import type { RangeQuery, RevenueQuery, TopServicesQuery } from './dashboard.validation';

const OPEN_BOOKINGS = ['pending', 'confirmed', 'in_progress'] as const;

/**
 * Net revenue in BDT between two instants:
 * successful (or later refunded) payments minus successful refunds.
 */
const netRevenue = async (from?: Date, to?: Date) => {
  const paidAt = { ...(from && { gte: from }), ...(to && { lt: to }) };
  const [paid, refunded] = await Promise.all([
    prisma.payment.aggregate({
      where: { type: 'payment', status: { in: ['success', 'refunded'] }, paidAt },
      _sum: { baseAmount: true },
    }),
    prisma.payment.aggregate({
      where: { type: 'refund', status: 'success', paidAt },
      _sum: { baseAmount: true },
    }),
  ]);
  return round2(toNumber(paid._sum.baseAmount) - toNumber(refunded._sum.baseAmount));
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
    const lastMonthStart = startOfBusinessDay(previousMonthStart(today));

    const [
      customers,
      staff,
      newCustomers,
      bookingsToday,
      upcomingBookings,
      pendingBookings,
      completedThisMonth,
      revenueThisMonth,
      revenueLastMonth,
      revenueTotal,
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
      prisma.booking.count({ where: { status: 'completed', updatedAt: { gte: monthStart } } }),
      netRevenue(monthStart),
      netRevenue(lastMonthStart, monthStart),
      netRevenue(),
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
      revenue: {
        thisMonth: revenueThisMonth,
        lastMonth: revenueLastMonth,
        total: revenueTotal,
        growthPercent:
          revenueLastMonth > 0
            ? round2(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
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

  /** Revenue chart: net BDT per day / month, split into bookings and adoption fees */
  async getRevenue({ from, to, groupBy }: RevenueQuery) {
    const start = startOfBusinessDay(from);
    const end = startOfBusinessDay(toDateString(addDays(dateOnly(to), 1)));
    // groupBy is validated by zod ('day' | 'month'), so Prisma.raw is safe here
    const unit = Prisma.raw(`'${groupBy}'`);
    const format = Prisma.raw(groupBy === 'day' ? `'YYYY-MM-DD'` : `'YYYY-MM'`);

    const rows = await prisma.$queryRaw<
      { period: string; bookings: string | null; adoptions: string | null; payments: bigint }[]
    >`
      SELECT
        to_char(date_trunc(${unit}, paid_at AT TIME ZONE 'UTC' AT TIME ZONE ${env.BUSINESS_TIMEZONE}), ${format}) AS period,
        SUM(CASE WHEN booking_id IS NOT NULL THEN (CASE WHEN type = 'refund' THEN -base_amount ELSE base_amount END) ELSE 0 END) AS bookings,
        SUM(CASE WHEN adoption_id IS NOT NULL THEN (CASE WHEN type = 'refund' THEN -base_amount ELSE base_amount END) ELSE 0 END) AS adoptions,
        COUNT(*) FILTER (WHERE type = 'payment') AS payments
      FROM payments
      WHERE paid_at >= ${start} AND paid_at < ${end}
        AND ((type = 'payment' AND status IN ('success', 'refunded')) OR (type = 'refund' AND status = 'success'))
      GROUP BY 1
      ORDER BY 1`;

    const byPeriod = new Map(rows.map((r) => [r.period, r]));
    const series = periods(from, to, groupBy).map((period) => {
      const row = byPeriod.get(period);
      const bookings = round2(toNumber(row?.bookings));
      const adoptions = round2(toNumber(row?.adoptions));
      return {
        period,
        bookings,
        adoptions,
        total: round2(bookings + adoptions),
        payments: Number(row?.payments ?? 0),
      };
    });

    return {
      from,
      to,
      groupBy,
      currency: 'BDT',
      total: round2(series.reduce((sum, p) => sum + p.total, 0)),
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
