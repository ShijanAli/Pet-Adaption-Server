import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { emailOutbox } from '@/shared/services/email.service';
import { settingsService } from '@/shared/services/settings.service';
import {
  API,
  api,
  bearer,
  bookViaApi,
  createAndLogin,
  flushEmails,
  login,
  loginAsSuperAdmin,
} from '../helpers';
import { bookableSetup, petTypeId } from '../helpers/fixtures';

let admin: string;

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
});

const slotsFor = async (serviceId: number, date: string) =>
  (
    await api().get(`${API}/services/${serviceId}/availability?date=${date}`).expect(200)
  ).body.data.slots.map((s: { startTime: string }) => s.startTime);

describe('Bookings — create', () => {
  it('books a free slot, assigns staff, snapshots the price and takes the slot', async () => {
    const { service, customer, pet, date, staff } = await bookableSetup({ price: 1200 });
    await prisma.service.update({ where: { id: service.id }, data: { discountPrice: 1000 } });

    const res = await bookViaApi(customer.accessToken, {
      serviceId: service.id,
      petId: pet.id,
      date,
      startTime: '10:00',
      customerNote: 'He is shy',
    }).expect(201);

    expect(res.body.data).toMatchObject({
      status: 'pending',
      paymentStatus: 'unpaid',
      bookingDate: date,
      startTime: '10:00',
      endTime: '11:00',
      servicePrice: '1000',
      totalAmount: '1000',
      assignedStaff: { id: staff[0].id },
      pet: { id: pet.id },
    });
    expect(res.body.data.bookingNo).toMatch(/^BK-\d{8}-[A-F0-9]{6}$/);
    expect(res.body.data.statusLogs).toHaveLength(1);

    // 09:30, 10:00, 10:30 now overlap → gone
    expect(await slotsFor(service.id, date)).toEqual(['09:00', '11:00', '11:30', '12:00']);

    // the price change later does not touch the booking
    await prisma.service.update({
      where: { id: service.id },
      data: { discountPrice: null, price: 5000 },
    });
    const mine = await api()
      .get(`${API}/me/bookings/${res.body.data.bookingNo}`)
      .set(bearer(customer.accessToken))
      .expect(200);
    expect(mine.body.data.totalAmount).toBe('1000');

    await flushEmails();
    expect(
      emailOutbox.some(
        (m) => m.template === 'BOOKING_RECEIVED' && m.to.email === customer.user.email,
      ),
    ).toBe(true);
  });

  it('validates pet, pet type, vaccination and time', async () => {
    const { service, customer, pet, date } = await bookableSetup();
    const stranger = await createAndLogin();

    // someone else's pet
    await bookViaApi(stranger.accessToken, {
      serviceId: service.id,
      petId: pet.id,
      date,
      startTime: '09:00',
    }).expect(404);

    // cat on a dog-only service
    const cat = await prisma.pet.create({
      data: { userId: customer.user.id, petTypeId: await petTypeId('cat'), name: 'Mimi' },
    });
    await bookViaApi(customer.accessToken, {
      serviceId: service.id,
      petId: cat.id,
      date,
      startTime: '09:00',
    }).expect(400);

    // vaccination required
    await prisma.service.update({ where: { id: service.id }, data: { requiresVaccination: true } });
    const unvaccinated = await prisma.pet.create({
      data: { userId: customer.user.id, petTypeId: await petTypeId('dog'), name: 'Rex' },
    });
    await bookViaApi(customer.accessToken, {
      serviceId: service.id,
      petId: unvaccinated.id,
      date,
      startTime: '09:00',
    }).expect(400);

    // outside working hours / not on the slot grid
    await bookViaApi(customer.accessToken, {
      serviceId: service.id,
      petId: pet.id,
      date,
      startTime: '15:00',
    }).expect(409);
    await bookViaApi(customer.accessToken, {
      serviceId: service.id,
      petId: pet.id,
      date,
      startTime: '09:10',
    }).expect(409);
    await bookViaApi(customer.accessToken, {
      serviceId: service.id,
      petId: pet.id,
      date,
      startTime: '9am',
    }).expect(422);
  });

  it('does not let the same pet be in two places at once', async () => {
    const { service, customer, pet, date } = await bookableSetup({ staffCount: 2 });
    await bookViaApi(customer.accessToken, {
      serviceId: service.id,
      petId: pet.id,
      date,
      startTime: '10:00',
    }).expect(201);
    const res = await bookViaApi(customer.accessToken, {
      serviceId: service.id,
      petId: pet.id,
      date,
      startTime: '10:30',
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/pet already has a booking/);
  });

  it('gives the last slot to exactly one of two simultaneous customers', async () => {
    const { service, customer, pet, date } = await bookableSetup();
    const rival = await createAndLogin();
    const rivalPet = await prisma.pet.create({
      data: { userId: rival.user.id, petTypeId: await petTypeId('dog'), name: 'Max' },
    });

    const results = await Promise.all([
      bookViaApi(customer.accessToken, {
        serviceId: service.id,
        petId: pet.id,
        date,
        startTime: '12:00',
      }),
      bookViaApi(rival.accessToken, {
        serviceId: service.id,
        petId: rivalPet.id,
        date,
        startTime: '12:00',
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);

    const count = await prisma.booking.count({
      where: { serviceId: service.id, startTime: '12:00' },
    });
    expect(count).toBe(1);
  });
});

describe('Bookings — customer side', () => {
  it('lists my bookings only and cancels with promo release', async () => {
    const { service, customer, pet, date } = await bookableSetup();
    const promo = await prisma.promotion.create({
      data: {
        title: 'Cancel test',
        code: `CXL${Date.now() % 100000}`,
        discountType: 'fixed',
        discountValue: 100,
        startsAt: new Date(Date.now() - 86_400_000),
        endsAt: new Date(Date.now() + 86_400_000 * 30),
      },
    });
    const booked = (
      await bookViaApi(customer.accessToken, {
        serviceId: service.id,
        petId: pet.id,
        date,
        startTime: '09:00',
        promoCode: promo.code,
      }).expect(201)
    ).body.data;

    const other = await createAndLogin();
    await api().get(`${API}/me/bookings/${booked.id}`).set(bearer(other.accessToken)).expect(404);
    const list = await api().get(`${API}/me/bookings`).set(bearer(other.accessToken)).expect(200);
    expect(list.body.meta.total).toBe(0);

    const res = await api()
      .patch(`${API}/me/bookings/${booked.bookingNo}/cancel`)
      .set(bearer(customer.accessToken))
      .send({ reason: 'Plans changed' })
      .expect(200);
    expect(res.body.data).toMatchObject({ status: 'cancelled', cancelReason: 'Plans changed' });

    expect((await prisma.promotion.findUniqueOrThrow({ where: { id: promo.id } })).usedCount).toBe(
      0,
    );
    expect(await slotsFor(service.id, date)).toContain('09:00');

    await api()
      .patch(`${API}/me/bookings/${booked.id}/cancel`)
      .set(bearer(customer.accessToken))
      .send({})
      .expect(400);
  });

  it('enforces the cancellation window setting', async () => {
    const { service, customer, pet, date } = await bookableSetup();
    const booked = (
      await bookViaApi(customer.accessToken, {
        serviceId: service.id,
        petId: pet.id,
        date,
        startTime: '09:00',
      }).expect(201)
    ).body.data;

    await prisma.setting.update({
      where: { key: 'booking_cancel_before_hours' },
      data: { value: 700 },
    });
    settingsService.invalidate();
    try {
      const res = await api()
        .patch(`${API}/me/bookings/${booked.id}/cancel`)
        .set(bearer(customer.accessToken))
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/700 hours/);
    } finally {
      await prisma.setting.update({
        where: { key: 'booking_cancel_before_hours' },
        data: { value: 24 },
      });
      settingsService.invalidate();
    }
  });
});

describe('Bookings — admin & staff', () => {
  it('follows the status workflow and logs every change', async () => {
    const { service, customer, pet, date } = await bookableSetup();
    const { id } = (
      await bookViaApi(customer.accessToken, {
        serviceId: service.id,
        petId: pet.id,
        date,
        startTime: '09:00',
      }).expect(201)
    ).body.data;
    const set = (status: string) =>
      api()
        .patch(`${API}/bookings/${id}/status`)
        .set(bearer(admin))
        .send({ status, note: `→ ${status}` });

    await set('completed').expect(400);
    await set('confirmed').expect(200);
    await set('in_progress').expect(200);
    await set('cancelled').expect(400);
    await set('completed').expect(200);

    const logs = await api().get(`${API}/bookings/${id}/logs`).set(bearer(admin)).expect(200);
    expect(logs.body.data.map((l: { toStatus: string }) => l.toStatus)).toEqual([
      'pending',
      'confirmed',
      'in_progress',
      'completed',
    ]);

    await flushEmails();
    const templates = emailOutbox
      .filter((m) => m.to.email === customer.user.email)
      .map((m) => m.template);
    expect(templates.filter((t) => t === 'BOOKING_STATUS_CHANGED')).toHaveLength(2); // confirmed + completed
  });

  it('staff can only update bookings assigned to them and see their own list', async () => {
    const { service, customer, pet, date, staff } = await bookableSetup();
    const { id } = (
      await bookViaApi(customer.accessToken, {
        serviceId: service.id,
        petId: pet.id,
        date,
        startTime: '09:00',
      }).expect(201)
    ).body.data;

    const outsider = await createAndLogin('staff');
    await api()
      .patch(`${API}/bookings/${id}/status`)
      .set(bearer(outsider.accessToken))
      .send({ status: 'confirmed' })
      .expect(403);

    const assigned = await login(staff[0].email, staff[0].password);
    await api()
      .patch(`${API}/bookings/${id}/status`)
      .set(bearer(assigned.accessToken))
      .send({ status: 'confirmed' })
      .expect(200);

    const mine = await api()
      .get(`${API}/staff/me/bookings`)
      .set(bearer(assigned.accessToken))
      .expect(200);
    expect(mine.body.data.map((b: { id: number }) => b.id)).toEqual([id]);

    // customers cannot use admin endpoints
    await api().get(`${API}/bookings`).set(bearer(customer.accessToken)).expect(403);
  });

  it('reassigns staff only to someone free who provides the service', async () => {
    const { service, customer, pet, date, staff } = await bookableSetup({ staffCount: 2 });
    const [a, b] = staff;
    const first = (
      await bookViaApi(customer.accessToken, {
        serviceId: service.id,
        petId: pet.id,
        date,
        startTime: '09:00',
        staffId: a.id,
      }).expect(201)
    ).body.data;
    expect(first.assignedStaff.id).toBe(a.id);

    const other = await createAndLogin();
    const otherPet = await prisma.pet.create({
      data: { userId: other.user.id, petTypeId: await petTypeId('dog'), name: 'Kiko' },
    });
    await bookViaApi(other.accessToken, {
      serviceId: service.id,
      petId: otherPet.id,
      date,
      startTime: '09:00',
      staffId: b.id,
    }).expect(201);

    // b is busy at 09:00
    await api()
      .patch(`${API}/bookings/${first.id}/assign-staff`)
      .set(bearer(admin))
      .send({ staffId: b.id })
      .expect(409);

    // someone who does not exist / does not provide the service
    const res = await api()
      .patch(`${API}/bookings/${first.id}/assign-staff`)
      .set(bearer(admin))
      .send({ staffId: 999999 });
    expect(res.status).toBe(409);
  });

  it('admin list supports search and filters', async () => {
    const { service, customer, pet, date } = await bookableSetup();
    const booked = (
      await bookViaApi(customer.accessToken, {
        serviceId: service.id,
        petId: pet.id,
        date,
        startTime: '09:00',
      }).expect(201)
    ).body.data;

    const res = await api()
      .get(`${API}/bookings`)
      .query({
        searchTerm: customer.user.email,
        status: 'pending',
        serviceId: service.id,
        from: date,
        to: date,
      })
      .set(bearer(admin))
      .expect(200);
    expect(res.body.data.map((b: { id: number }) => b.id)).toEqual([booked.id]);
    expect(res.body.data[0].user.email).toBe(customer.user.email);
  });
});
