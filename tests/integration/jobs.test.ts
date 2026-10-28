import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { settingsService } from '@/shared/services/settings.service';
import { BookingService } from '@/modules/bookings/bookings.service';
import { cleanupTokens } from '@/jobs/cleanupTokens.job';
import { runExclusive, type Job } from '@/jobs/scheduler';
import { API, api, bearer, bookViaApi, createAndLogin, flushEmails } from '../helpers';
import { bookableSetup } from '../helpers/fixtures';

const HOUR = 3_600_000;

/** Makes a booking look `ms` old */
const age = (id: number, ms: number) =>
  prisma.booking.update({ where: { id }, data: { createdAt: new Date(Date.now() - ms) } });

describe('Job: expire unpaid bookings', () => {
  it('cancels old unpaid pending bookings and frees the slot', async () => {
    const { service, customer, pet, date } = await bookableSetup();
    const booking = (
      await bookViaApi(customer.accessToken, {
        serviceId: service.id,
        petId: pet.id,
        date,
        startTime: '09:00',
      }).expect(201)
    ).body.data;

    await BookingService.expireUnpaid();
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
      'pending',
    ); // still fresh

    await age(booking.id, HOUR);
    const { expired } = await BookingService.expireUnpaid();
    expect(expired).toBeGreaterThanOrEqual(1);

    const after = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { statusLogs: true },
    });
    expect(after).toMatchObject({
      status: 'cancelled',
      cancelReason: 'Payment not received within 30 minutes',
    });
    expect(after.statusLogs.at(-1)).toMatchObject({ toStatus: 'cancelled', changedById: null });

    const slots = await api()
      .get(`${API}/services/${service.id}/availability?date=${date}`)
      .expect(200);
    expect(slots.body.data.slots.map((s: { startTime: string }) => s.startTime)).toContain('09:00');

    await flushEmails();
    const { emailOutbox } = await import('@/shared/services/email.service');
    expect(
      emailOutbox.some(
        (m) => m.to.email === customer.user.email && m.subject.includes('cancelled'),
      ),
    ).toBe(true);
  });

  it('keeps paid / confirmed bookings and customers who are on the payment page', async () => {
    const { service, customer, pet, date } = await bookableSetup({ staffCount: 2 });
    const book = async (startTime: string) =>
      (
        await bookViaApi(customer.accessToken, {
          serviceId: service.id,
          petId: pet.id,
          date,
          startTime,
        }).expect(201)
      ).body.data;

    const confirmed = await book('09:00');
    await prisma.booking.update({ where: { id: confirmed.id }, data: { status: 'confirmed' } });
    const paying = await book('11:00');
    await prisma.payment.create({
      data: {
        userId: customer.user.id,
        bookingId: paying.id,
        amount: 1000,
        baseAmount: 1000,
        method: 'sslcommerz',
        transactionId: `TXN-JOB-${Date.now()}`,
      },
    });
    await age(confirmed.id, HOUR);
    await age(paying.id, HOUR);

    await BookingService.expireUnpaid();
    const statuses = await prisma.booking.findMany({
      where: { id: { in: [confirmed.id, paying.id] } },
      select: { status: true },
    });
    expect(statuses.map((s) => s.status).sort()).toEqual(['confirmed', 'pending']);
  });

  it('can be switched off with booking_payment_timeout_minutes = 0', async () => {
    const { service, customer, pet, date } = await bookableSetup();
    const booking = (
      await bookViaApi(customer.accessToken, {
        serviceId: service.id,
        petId: pet.id,
        date,
        startTime: '09:00',
      }).expect(201)
    ).body.data;
    await age(booking.id, 10 * HOUR);

    await prisma.setting.update({
      where: { key: 'booking_payment_timeout_minutes' },
      data: { value: 0 },
    });
    settingsService.invalidate();
    try {
      expect(await BookingService.expireUnpaid()).toEqual({ expired: 0 });
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
        'pending',
      );
    } finally {
      await prisma.setting.update({
        where: { key: 'booking_payment_timeout_minutes' },
        data: { value: 30 },
      });
      settingsService.invalidate();
    }
  });
});

describe('Job: cleanup tokens', () => {
  it('deletes expired / long-revoked tokens but keeps live ones', async () => {
    const { user } = await createAndLogin();
    const live = await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } });
    const old = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `old-${Date.now()}`,
        expiresAt: new Date(Date.now() - 3 * 86_400_000),
      },
    });
    const revoked = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `revoked-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: new Date(Date.now() - 40 * 86_400_000),
      },
    });

    const result = await cleanupTokens();
    expect(result.refreshTokens).toBeGreaterThanOrEqual(2);
    const remaining = await prisma.refreshToken.findMany({
      where: { id: { in: [live.id, old.id, revoked.id] } },
    });
    expect(remaining.map((t) => t.id)).toEqual([live.id]);
  });
});

describe('Scheduler', () => {
  it('runs a job only once at a time across processes (advisory lock)', async () => {
    let runs = 0;
    const job: Job = {
      name: 'slow-test-job',
      everyMs: 60_000,
      lockKey: 9_999,
      run: async () => {
        runs++;
        await new Promise((r) => setTimeout(r, 300));
      },
    };
    const results = await Promise.all([runExclusive(job), runExclusive(job)]);
    expect(runs).toBe(1);
    expect(results.filter((r) => r.skipped)).toHaveLength(1);
  });

  it('is not reachable over HTTP', async () => {
    const { accessToken } = await createAndLogin();
    await api().post(`${API}/jobs/run`).set(bearer(accessToken)).expect(404);
  });
});
