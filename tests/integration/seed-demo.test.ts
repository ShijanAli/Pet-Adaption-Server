import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedDemo } from '../../prisma/seed-demo';
import { API, api } from '../helpers';

const count = (sql: TemplateStringsArray) =>
  prisma.$queryRaw<{ n: bigint }[]>(sql).then((r) => Number(r[0].n));

describe('Demo data seeder', () => {
  afterAll(() => seedDemo(['--remove']));

  let baseline = { bookings: 0, users: 0 };

  it('creates consistent history the API can serve', async () => {
    // other test files share this database → compare against what was there before
    baseline = { bookings: await prisma.booking.count(), users: await prisma.user.count() };
    await seedDemo();

    expect((await prisma.booking.count()) - baseline.bookings).toBeGreaterThan(300);
    expect(
      await prisma.review.count({ where: { user: { email: { endsWith: '@demo.petplex.dev' } } } }),
    ).toBeGreaterThan(50);
    // business rules the API enforces must hold for seeded rows too
    expect(
      await count`
      SELECT COUNT(*)::bigint AS n FROM bookings a JOIN bookings b
        ON a.assigned_staff_id = b.assigned_staff_id AND a.booking_date = b.booking_date AND a.id < b.id
       AND a.status <> 'cancelled' AND b.status <> 'cancelled'
       AND a.start_time < b.end_time AND a.end_time > b.start_time`,
    ).toBe(0);
    expect(
      await count`
      SELECT COUNT(*)::bigint AS n FROM bookings b JOIN pets p ON p.id = b.pet_id
       WHERE p.user_id <> b.user_id
          OR NOT EXISTS (SELECT 1 FROM service_pet_types s WHERE s.service_id = b.service_id AND s.pet_type_id = p.pet_type_id)`,
    ).toBe(0);
    expect(
      await count`
      SELECT COUNT(*)::bigint AS n FROM reviews r JOIN bookings b ON b.id = r.booking_id
       WHERE b.status <> 'completed' OR b.user_id <> r.user_id`,
    ).toBe(0);
    expect(
      await count`
      SELECT COUNT(*)::bigint AS n FROM bookings b
       WHERE b.payment_status = 'paid'
         AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.status = 'success')`,
    ).toBe(0);

    const list = await api().get(`${API}/services?limit=100`).expect(200);
    const rated = list.body.data.filter((s: { reviewsCount: number }) => s.reviewsCount > 0);
    expect(rated.length).toBeGreaterThan(5);
  });

  it('is idempotent and removes only what it created', async () => {
    const before = await prisma.booking.count();
    await seedDemo(); // second run is a no-op
    expect(await prisma.booking.count()).toBe(before);

    const faq = await prisma.faq.create({ data: { question: 'Mine?', answer: 'Yes' } });
    await seedDemo(['--remove']);
    expect(await prisma.booking.count()).toBe(baseline.bookings);
    expect(await prisma.user.count()).toBe(baseline.users);
    expect(await prisma.user.count({ where: { email: { endsWith: '@demo.petplex.dev' } } })).toBe(
      0,
    );
    expect(await prisma.faq.findUnique({ where: { id: faq.id } })).not.toBeNull();
    expect(await prisma.setting.count({ where: { key: '__demo_seed' } })).toBe(0);
    await prisma.faq.delete({ where: { id: faq.id } });
  });

  it('refuses to run in production without --force', async () => {
    const original = process.env.NODE_ENV;
    const { env } = await import('@/config/env');
    const prev = env.NODE_ENV;
    (env as { NODE_ENV: string }).NODE_ENV = 'production';
    await expect(seedDemo()).rejects.toThrow(/Refusing/);
    (env as { NODE_ENV: string }).NODE_ENV = prev;
    process.env.NODE_ENV = original;
  });
});
