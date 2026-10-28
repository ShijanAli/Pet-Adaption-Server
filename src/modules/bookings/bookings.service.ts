import type { BookingStatus } from '@generated/prisma/client';
import { prisma, type TransactionClient } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { emailService } from '@/shared/services/email.service';
import { notificationService } from '@/shared/services/notification.service';
import { settingsService } from '@/shared/services/settings.service';
import { hasPermission } from '@/shared/utils/access';
import { generateReferenceNo } from '@/shared/utils/common';
import { formatMoney, round2, toNumber } from '@/shared/utils/money';
import {
  dateOnly,
  minutesToTime,
  minutesUntil,
  rangesOverlap,
  timeToMinutes,
  toDateString,
} from '@/shared/utils/time';
import { serializableTransaction } from '@/shared/utils/transaction';
import { whereIdOr } from '@/shared/utils/validation';
import type { AuthUser } from '@/shared/types/auth';
import { AvailabilityService } from '@/modules/availability/availability.service';
import { PromotionService } from '@/modules/promotions/promotions.service';
import {
  adminBookingInclude,
  adminBookingQueryConfig,
  bookingDetailInclude,
  bookingInclude,
  CUSTOMER_CANCELLABLE,
  myBookingQueryConfig,
  NOTIFY_STATUSES,
  OPEN_BOOKING_STATUSES,
  STATUS_TRANSITIONS,
} from './bookings.constant';
import type { BookingListQuery, CreateBookingInput } from './bookings.validation';

/* ───────────────────────── helpers ───────────────────────── */

const myBookings = createCrudService({
  delegate: () => prisma.booking,
  entityName: 'Booking',
  queryConfig: myBookingQueryConfig,
  include: bookingInclude,
});

const allBookings = createCrudService({
  delegate: () => prisma.booking,
  entityName: 'Booking',
  queryConfig: adminBookingQueryConfig,
  include: adminBookingInclude,
});

/** @db.Date → "YYYY-MM-DD" in responses */
const toDto = <T extends { bookingDate: Date }>(b: T) => ({
  ...b,
  bookingDate: toDateString(b.bookingDate),
});

const mapPage = <T extends { bookingDate: Date }>(page: { data: unknown; meta: unknown }) => ({
  data: (page.data as T[]).map(toDto),
  meta: page.meta as never,
});

const whereIdOrNo = (value: string) => whereIdOr('bookingNo', value);

const OPEN = [...OPEN_BOOKING_STATUSES];

type BookingForEmail = {
  bookingNo: string;
  bookingDate: Date | string;
  startTime: string;
  endTime: string;
  totalAmount: { toString(): string };
  user: { id: number; firstName: string; email: string };
  service: { name: string };
  pet: { name: string };
};

const summary = (b: BookingForEmail) => ({
  name: b.user.firstName,
  bookingNo: b.bookingNo,
  serviceName: b.service.name,
  petName: b.pet.name,
  date: typeof b.bookingDate === 'string' ? b.bookingDate : toDateString(b.bookingDate),
  time: `${b.startTime} – ${b.endTime}`,
  total: formatMoney(toNumber(b.totalAmount)),
});

const notifyStatus = (b: BookingForEmail, status: BookingStatus, note?: string | null) => {
  emailService.queue({ email: b.user.email, name: b.user.firstName }, 'BOOKING_STATUS_CHANGED', {
    ...summary(b),
    status,
    note,
  });
  notificationService.notify(b.user.id, {
    type: `booking.${status}`,
    title: `Booking ${b.bookingNo} ${status.replace('_', ' ')}`,
    message: `${b.service.name} for ${b.pet.name} on ${summary(b).date} at ${b.startTime}`,
    data: { bookingNo: b.bookingNo },
  });
};

const writeLog = (
  tx: TransactionClient,
  bookingId: number,
  fromStatus: BookingStatus | null,
  toStatus: BookingStatus,
  changedById: number | null,
  note?: string | null,
) => tx.bookingStatusLog.create({ data: { bookingId, fromStatus, toStatus, changedById, note } });

const getDetail = async (where: Record<string, unknown>) => {
  const booking = await prisma.booking.findFirst({ where, include: bookingDetailInclude });
  if (!booking) throw AppError.notFound('Booking');
  return toDto(booking);
};

/** Changes status + writes the log + releases the promo on cancellation */
const transition = async (
  bookingId: number,
  from: BookingStatus,
  to: BookingStatus,
  actorId: number | null,
  note?: string | null,
) =>
  prisma.$transaction(async (tx) => {
    // conditional update guards against two people changing the status at once
    const { count } = await tx.booking.updateMany({
      where: { id: bookingId, status: from },
      data: {
        status: to,
        ...(to === 'cancelled' && { cancelledAt: new Date(), cancelReason: note ?? null }),
      },
    });
    if (count === 0)
      throw AppError.conflict('Booking status changed in the meantime, please reload');
    await writeLog(tx, bookingId, from, to, actorId, note);
    if (to === 'cancelled') await PromotionService.release(tx, bookingId);
  });

/* ───────────────────────── service ───────────────────────── */

export const BookingService = {
  /**
   * Creates a booking for the logged-in customer.
   * Slot availability is checked again inside a SERIALIZABLE transaction,
   * so two customers can never get the same staff member at the same time.
   */
  async create(user: AuthUser, input: CreateBookingInput) {
    const pet = await prisma.pet.findFirst({ where: { id: input.petId, userId: user.id } });
    if (!pet) throw AppError.notFound('Pet');

    const service = await prisma.service.findFirst({
      where: {
        id: input.serviceId,
        status: 'active',
        category: { status: 'active', deletedAt: null },
      },
      include: { petTypes: { select: { petTypeId: true } } },
    });
    if (!service) throw AppError.notFound('Service');
    if (!service.petTypes.some((p) => p.petTypeId === pet.petTypeId)) {
      throw AppError.badRequest('This service is not available for this type of pet');
    }
    if (service.requiresVaccination && !pet.isVaccinated) {
      throw AppError.badRequest(
        'This service requires a vaccinated pet. Update your pet profile first',
      );
    }
    if (input.addressId) {
      const address = await prisma.userAddress.findFirst({
        where: { id: input.addressId, userId: user.id },
      });
      if (!address) throw AppError.notFound('Address');
    }

    // availability (schedule, blocked days, advance window, past time …)
    const freeStaff = await AvailabilityService.getFreeStaffAt({
      serviceId: service.id,
      date: input.date,
      startTime: input.startTime,
      staffId: input.staffId,
    });
    if (!freeStaff.length)
      throw AppError.conflict('This time slot is not available. Please pick another one');

    const bookingDate = dateOnly(input.date);
    const start = timeToMinutes(input.startTime);
    const end = start + service.durationMinutes;
    const servicePrice = toNumber(service.discountPrice ?? service.price);

    const booking = await serializableTransaction(async (tx) => {
      const dayBookings = await tx.booking.findMany({
        where: {
          bookingDate,
          status: { in: OPEN },
          OR: [{ assignedStaffId: { in: freeStaff.map((s) => s.id) } }, { petId: pet.id }],
        },
        select: { assignedStaffId: true, petId: true, startTime: true, endTime: true },
      });
      const overlaps = (b: { startTime: string; endTime: string }) =>
        rangesOverlap(start, end, timeToMinutes(b.startTime), timeToMinutes(b.endTime));

      if (dayBookings.some((b) => b.petId === pet.id && overlaps(b))) {
        throw AppError.conflict('This pet already has a booking at that time');
      }

      // least busy free staff member gets the booking
      const load = (id: number) => dayBookings.filter((b) => b.assignedStaffId === id).length;
      const staff = freeStaff
        .filter((s) => !dayBookings.some((b) => b.assignedStaffId === s.id && overlaps(b)))
        .sort((a, b) => load(a.id) - load(b.id))[0];
      if (!staff)
        throw AppError.conflict('This time slot was just booked. Please pick another one');

      const promo = input.promoCode
        ? await PromotionService.evaluate(tx, input.promoCode, user.id, {
            id: service.id,
            categoryId: service.categoryId,
            price: servicePrice,
          })
        : null;
      const discountAmount = promo?.discountAmount ?? 0;

      const created = await tx.booking.create({
        data: {
          bookingNo: generateReferenceNo('BK'),
          userId: user.id,
          petId: pet.id,
          serviceId: service.id,
          assignedStaffId: staff.id,
          promotionId: promo?.promotion.id,
          addressId: input.addressId,
          bookingDate,
          startTime: input.startTime,
          endTime: minutesToTime(end),
          servicePrice,
          discountAmount,
          totalAmount: round2(servicePrice - discountAmount),
          customerNote: input.customerNote,
        },
      });
      await writeLog(tx, created.id, null, 'pending', user.id, 'Booking created');
      if (promo) {
        await PromotionService.reserve(tx, promo.promotion.id, {
          userId: user.id,
          bookingId: created.id,
          discountAmount,
        });
      }
      return created;
    });

    // relations are loaded after the transaction (keeps the locked section short)
    const detail = await getDetail({ id: booking.id });
    emailService.queue(
      { email: detail.user.email, name: detail.user.firstName },
      'BOOKING_RECEIVED',
      summary(detail),
    );
    notificationService.notify(user.id, {
      type: 'booking.created',
      title: `Booking ${detail.bookingNo} received`,
      message: `${detail.service.name} on ${input.date} at ${input.startTime}`,
      data: { bookingNo: detail.bookingNo },
    });
    return detail;
  },

  /* ───── customer ───── */

  getMine: async (userId: number, query: BookingListQuery) =>
    mapPage(await myBookings.getAll(query, { userId })),

  getMineByIdOrNo: (userId: number, idOrNo: string) =>
    getDetail({ ...whereIdOrNo(idOrNo), userId }),

  async cancelMine(userId: number, idOrNo: string, reason?: string) {
    const booking = await prisma.booking.findFirst({
      where: { ...whereIdOrNo(idOrNo), userId },
      include: adminBookingInclude,
    });
    if (!booking) throw AppError.notFound('Booking');
    if (!CUSTOMER_CANCELLABLE.includes(booking.status)) {
      throw AppError.badRequest(
        `A ${booking.status.replace('_', ' ')} booking cannot be cancelled`,
      );
    }

    const hours = await settingsService.getNumber('booking_cancel_before_hours');
    if (minutesUntil(toDateString(booking.bookingDate), booking.startTime) < hours * 60) {
      throw AppError.badRequest(
        `Bookings can only be cancelled at least ${hours} hours in advance`,
      );
    }

    await transition(
      booking.id,
      booking.status,
      'cancelled',
      userId,
      reason ?? 'Cancelled by customer',
    );
    notifyStatus(booking, 'cancelled', reason);
    return getDetail({ id: booking.id });
  },

  /* ───── admin / staff ───── */

  getAll: async (query: BookingListQuery) => mapPage(await allBookings.getAll(query)),

  getById: (id: number) => getDetail({ id }),

  getAssigned: async (staffId: number, query: BookingListQuery) =>
    mapPage(await allBookings.getAll(query, { assignedStaffId: staffId })),

  async getLogs(id: number) {
    await allBookings.getById(id);
    return prisma.bookingStatusLog.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: 'asc' },
      include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  },

  async updateStatus(actor: AuthUser, id: number, status: BookingStatus, note?: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: adminBookingInclude,
    });
    if (!booking) throw AppError.notFound('Booking');

    // staff (no assign permission) can only work on their own bookings
    const isManager = await hasPermission(actor, PERMISSIONS.BOOKING.ASSIGN_STAFF);
    if (!isManager && booking.assignedStaffId !== actor.id) {
      throw AppError.forbidden('You can only update bookings assigned to you');
    }
    if (!STATUS_TRANSITIONS[booking.status].includes(status)) {
      throw AppError.badRequest(`Cannot change status from ${booking.status} to ${status}`);
    }

    await transition(id, booking.status, status, actor.id, note);
    if (NOTIFY_STATUSES.includes(status)) notifyStatus(booking, status, note);
    return getDetail({ id });
  },

  /**
   * Background job: cancels `pending` + `unpaid` bookings older than the
   * `booking_payment_timeout_minutes` setting, so abandoned checkouts free their slot.
   * Bookings with a gateway payment started in the last 15 minutes are left alone
   * (the customer may still be on the payment page).
   */
  async expireUnpaid(now = new Date()) {
    const minutes = await settingsService.getNumber('booking_payment_timeout_minutes');
    if (!minutes) return { expired: 0 };

    const stale = await prisma.booking.findMany({
      where: {
        status: 'pending',
        paymentStatus: 'unpaid',
        createdAt: { lt: new Date(now.getTime() - minutes * 60_000) },
        payments: {
          none: { status: 'pending', createdAt: { gte: new Date(now.getTime() - 15 * 60_000) } },
        },
      },
      include: adminBookingInclude,
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    let expired = 0;
    const note = `Payment not received within ${minutes} minutes`;
    for (const booking of stale) {
      try {
        await transition(booking.id, 'pending', 'cancelled', null, note);
        notifyStatus(booking, 'cancelled', note);
        expired++;
      } catch {
        // status changed concurrently (e.g. paid or confirmed by an admin) — skip
      }
    }
    return { expired };
  },

  async assignStaff(id: number, staffId: number) {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) throw AppError.notFound('Booking');
    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw AppError.badRequest('Staff can only be changed on pending or confirmed bookings');
    }
    if (booking.assignedStaffId === staffId) return getDetail({ id });

    const free = await AvailabilityService.getFreeStaffAt({
      serviceId: booking.serviceId,
      date: toDateString(booking.bookingDate),
      startTime: booking.startTime,
      staffId,
      excludeBookingId: id,
    });
    if (!free.length) {
      throw AppError.conflict(
        'This staff member is not available (or does not provide this service) at that time',
      );
    }
    await prisma.booking.update({ where: { id }, data: { assignedStaffId: staffId } });
    return getDetail({ id });
  },
};
