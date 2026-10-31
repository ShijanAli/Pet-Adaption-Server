import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { settingsService } from '@/shared/services/settings.service';
import { nowInBusinessTz } from '@/shared/utils/time';
import { API, api, bearer, createAndLogin, loginAsSuperAdmin, uniqueEmail } from '../helpers';
import { bookableSetup } from '../helpers/fixtures';

let admin: string;
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
});

describe('Settings', () => {
  it('exposes only public settings publicly', async () => {
    const res = await api().get(`${API}/settings/public`).expect(200);
    expect(res.body.data).toMatchObject({ site_name: 'Pet Adoption', base_currency: 'BDT' });
    expect(res.body.data.admin_notification_email).toBeUndefined();
  });

  it('serves the default opening hours even before a row exists, and validates edits', async () => {
    await prisma.setting.deleteMany({ where: { key: 'opening_hours' } });
    const pub = await api().get(`${API}/settings/public`).expect(200);
    expect(pub.body.data.opening_hours).toHaveLength(7);
    expect(pub.body.data.opening_hours[1]).toEqual({
      day: 1,
      open: true,
      opens: '08:00',
      closes: '19:00',
    });

    const all = await api().get(`${API}/settings`).set(bearer(admin)).expect(200);
    expect(
      all.body.data.find((s: { key: string }) => s.key === 'opening_hours')?.value,
    ).toHaveLength(7);
    // internal rows stay hidden, real rows keep their stored values
    await prisma.setting.upsert({
      where: { key: '__internal' },
      update: {},
      create: { key: '__internal', value: 1 },
    });
    const keys = (await api().get(`${API}/settings`).set(bearer(admin)).expect(200)).body.data.map(
      (s: { key: string }) => s.key,
    );
    expect(keys).not.toContain('__internal');
    expect(keys).toContain('site_name');
    await prisma.setting.delete({ where: { key: '__internal' } });

    const week = pub.body.data.opening_hours.map((d: { day: number }) => ({
      ...d,
      open: d.day !== 5,
    }));
    const bad = await api()
      .patch(`${API}/settings`)
      .set(bearer(admin))
      .send({
        values: {
          opening_hours: week.map((d: object, i: number) =>
            i === 2 ? { ...d, opens: '18:00', closes: '09:00' } : d,
          ),
        },
      })
      .expect(422);
    expect(bad.body.errors[0]).toMatchObject({
      path: 'values.opening_hours',
      message: 'Closing time must be after opening time',
    });
    await api()
      .patch(`${API}/settings`)
      .set(bearer(admin))
      .send({ values: { opening_hours: week.slice(1) } })
      .expect(422);

    await api()
      .patch(`${API}/settings`)
      .set(bearer(admin))
      .send({ values: { opening_hours: week } })
      .expect(200);
    const after = await api().get(`${API}/settings/public`).expect(200);
    expect(after.body.data.opening_hours[5].open).toBe(false);
  });

  it('validates every value and saves all-or-nothing', async () => {
    const bad = await api()
      .patch(`${API}/settings`)
      .set(bearer(admin))
      .send({
        values: {
          usd_exchange_rate: -5,
          base_currency: 'USD',
          nope: 1,
          booking_slot_interval_minutes: 7,
          site_name: 'Changed',
        },
      })
      .expect(422);
    expect(bad.body.errors.map((e: { path: string }) => e.path).sort()).toEqual([
      'values.base_currency',
      'values.booking_slot_interval_minutes',
      'values.nope',
      'values.usd_exchange_rate',
    ]);
    expect(await settingsService.get('site_name')).toBe('Pet Adoption');

    try {
      const ok = await api()
        .patch(`${API}/settings`)
        .set(bearer(admin))
        .send({
          values: {
            usd_exchange_rate: 120.5,
            social_links: { facebook: 'https://facebook.com/pets' },
          },
        })
        .expect(200);
      expect(ok.body.data.find((s: { key: string }) => s.key === 'usd_exchange_rate').value).toBe(
        120.5,
      );
      expect(await settingsService.get('usd_exchange_rate')).toBe(120.5);
    } finally {
      await api()
        .patch(`${API}/settings`)
        .set(bearer(admin))
        .send({ values: { usd_exchange_rate: 122, social_links: {} } })
        .expect(200);
    }

    const { accessToken } = await createAndLogin();
    await api()
      .patch(`${API}/settings`)
      .set(bearer(accessToken))
      .send({ values: { site_name: 'x' } })
      .expect(403);
  });
});

describe('Notifications', () => {
  it('lists, counts and marks my notifications', async () => {
    const me = await createAndLogin();
    const other = await createAndLogin();
    await prisma.notification.createMany({
      data: [1, 2, 3].map((n) => ({
        userId: me.user.id,
        type: 'test',
        title: `Hello ${n}`,
        message: 'Hi',
      })),
    });
    const theirs = await prisma.notification.create({
      data: { userId: other.user.id, type: 'test', title: 'Theirs', message: 'x' },
    });

    const count = await api()
      .get(`${API}/me/notifications/unread-count`)
      .set(bearer(me.accessToken))
      .expect(200);
    expect(count.body.data.count).toBe(3);

    const list = await api()
      .get(`${API}/me/notifications?unread=true`)
      .set(bearer(me.accessToken))
      .expect(200);
    expect(list.body.meta.total).toBe(3);

    await api()
      .patch(`${API}/me/notifications/${list.body.data[0].id}/read`)
      .set(bearer(me.accessToken))
      .expect(200);
    await api()
      .patch(`${API}/me/notifications/${theirs.id}/read`)
      .set(bearer(me.accessToken))
      .expect(404);

    const all = await api()
      .patch(`${API}/me/notifications/read-all`)
      .set(bearer(me.accessToken))
      .expect(200);
    expect(all.body.data.updated).toBe(2);
    expect(
      (await api().get(`${API}/me/notifications/unread-count`).set(bearer(me.accessToken))).body
        .data.count,
    ).toBe(0);
  });

  it('booking a service creates a notification', async () => {
    const { service, customer, pet, date } = await bookableSetup();
    await api()
      .post(`${API}/bookings`)
      .set(bearer(customer.accessToken))
      .send({ serviceId: service.id, petId: pet.id, date, startTime: '09:00' })
      .expect(201);
    await wait();
    const list = await api()
      .get(`${API}/me/notifications`)
      .set(bearer(customer.accessToken))
      .expect(200);
    expect(list.body.data[0].type).toBe('booking.created');
  });
});

describe('Activity logs', () => {
  it('records admin writes automatically and redacts secrets', async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { slug: 'staff' } });
    const email = uniqueEmail('audited');
    const created = await api()
      .post(`${API}/users`)
      .set(bearer(admin))
      .send({ firstName: 'Audit', lastName: 'Me', email, password: 'Secret@123', roleId: role.id })
      .expect(201);
    await api()
      .patch(`${API}/users/${created.body.data.id}`)
      .set(bearer(admin))
      .send({ bio: 'Groomer' })
      .expect(200);
    await api()
      .patch(`${API}/users/${created.body.data.id}`)
      .set(bearer(admin))
      .send({})
      .expect(422); // failed → not logged
    await wait();

    const res = await api()
      .get(`${API}/activity-logs`)
      .query({ modelType: 'Users', searchTerm: 'Super' })
      .set(bearer(admin))
      .expect(200);
    const mine = res.body.data.filter(
      (l: { newValues: { body?: { email?: string } }; modelId: number | null }) =>
        l.newValues.body?.email === email || l.modelId === created.body.data.id,
    );
    expect(mine.map((l: { action: string }) => l.action).sort()).toEqual(['create', 'update']);
    const createLog = mine.find((l: { action: string }) => l.action === 'create');
    expect(createLog.newValues.body.password).toBe('[redacted]');
    expect(createLog.newValues.route).toBe('POST /users');
    expect(createLog.user.email).toBe('superadmin@petadoption.com');
  });
});

describe('Dashboard', () => {
  it('returns the stats cards', async () => {
    const res = await api().get(`${API}/dashboard/stats`).set(bearer(admin)).expect(200);
    expect(res.body.data).toMatchObject({
      currency: 'BDT',
      users: { customers: expect.any(Number) },
      bookings: { upcoming: expect.any(Number) },
      revenue: { thisMonth: expect.any(Number), total: expect.any(Number) },
      adoption: { availablePets: expect.any(Number) },
    });
    const { accessToken } = await createAndLogin();
    await api().get(`${API}/dashboard/stats`).set(bearer(accessToken)).expect(403);
  });

  it('adds today’s payments to the revenue chart and fills empty days', async () => {
    const today = nowInBusinessTz().date;
    const from = `${today.slice(0, 7)}-01`;
    const revenue = async () =>
      (
        await api()
          .get(`${API}/dashboard/revenue`)
          .query({ from, to: today })
          .set(bearer(admin))
          .expect(200)
      ).body.data;

    const before = await revenue();
    expect(before.series).toHaveLength(Number(today.slice(8)));

    const { service, customer, pet, date } = await bookableSetup({ price: 750 });
    const booking = (
      await api()
        .post(`${API}/bookings`)
        .set(bearer(customer.accessToken))
        .send({ serviceId: service.id, petId: pet.id, date, startTime: '09:00' })
        .expect(201)
    ).body.data;
    await api()
      .post(`${API}/payments/cash`)
      .set(bearer(admin))
      .send({ bookingId: booking.id })
      .expect(201);

    const after = await revenue();
    const todayPoint = (d: { series: { period: string; bookings: number }[] }) =>
      d.series.find((p) => p.period === today)!;
    expect(todayPoint(after).bookings - todayPoint(before).bookings).toBe(750);
    expect(after.total - before.total).toBe(750);

    const top = await api()
      .get(`${API}/dashboard/top-services`)
      .query({ from: date, to: date, limit: 50 })
      .set(bearer(admin))
      .expect(200);
    expect(
      top.body.data.some((t: { service: { id: number } }) => t.service.id === service.id),
    ).toBe(true);

    const byStatus = await api()
      .get(`${API}/dashboard/bookings-by-status`)
      .query({ from: date, to: date })
      .set(bearer(admin))
      .expect(200);
    expect(byStatus.body.data.confirmed).toBeGreaterThanOrEqual(1);

    await api()
      .get(`${API}/dashboard/revenue`)
      .query({ from: today, to: from > today ? from : '2020-01-01' })
      .set(bearer(admin))
      .expect(422);
  });
});
