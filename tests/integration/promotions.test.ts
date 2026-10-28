import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { API, api, bearer, bookViaApi, createAndLogin, loginAsSuperAdmin } from '../helpers';
import { bookableSetup, createService } from '../helpers/fixtures';

let admin: string;
let seq = 0;

const code = () => `SAVE${Date.now() % 100000}${++seq}`;
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

const createPromo = (body: Record<string, unknown>) =>
  api()
    .post(`${API}/promotions`)
    .set(bearer(admin))
    .send({
      title: 'Test offer',
      code: code(),
      discountType: 'percentage',
      discountValue: 20,
      startsAt: inDays(-1),
      endsAt: inDays(10),
      ...body,
    });

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
});

describe('Promotions — admin', () => {
  it('creates a promotion with an upper-cased unique code', async () => {
    const raw = `winter${Date.now() % 100000}`;
    const res = await createPromo({ code: raw }).expect(201);
    expect(res.body.data).toMatchObject({
      code: raw.toUpperCase(),
      usedCount: 0,
      appliesTo: 'all',
    });
    await createPromo({ code: raw }).expect(409);
  });

  it('validates value and date rules', async () => {
    await createPromo({ discountValue: 150 }).expect(422);
    await createPromo({ startsAt: inDays(5), endsAt: inDays(1) }).expect(422);
    await createPromo({ appliesTo: 'specific_services', serviceIds: [] }).expect(422);
    await createPromo({ appliesTo: 'specific_services', serviceIds: [999999] }).expect(400);
  });

  it('lists running promotions publicly, hides inactive / expired ones', async () => {
    const live = (await createPromo({}).expect(201)).body.data;
    const off = (await createPromo({ status: 'inactive' }).expect(201)).body.data;
    const old = (await createPromo({ startsAt: inDays(-10), endsAt: inDays(-1) }).expect(201)).body
      .data;

    const res = await api().get(`${API}/promotions/active`).expect(200);
    const ids = res.body.data.map((p: { id: number }) => p.id);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(off.id);
    expect(ids).not.toContain(old.id);
    expect(res.body.data[0].usageLimit).toBeUndefined(); // internal fields are not public
  });
});

describe('Promotions — checkout preview', () => {
  it('applies a capped percentage discount', async () => {
    const service = await createService({ price: 1000 });
    const promo = (await createPromo({ discountValue: 20, maxDiscountAmount: 150 }).expect(201))
      .body.data;
    const { accessToken } = await createAndLogin();

    const res = await api()
      .post(`${API}/promotions/validate`)
      .set(bearer(accessToken))
      .send({ code: promo.code.toLowerCase(), serviceId: service.id })
      .expect(200);
    expect(res.body.data).toMatchObject({
      servicePrice: 1000,
      discountAmount: 150,
      totalAmount: 850,
    });
  });

  it('explains why a code cannot be used', async () => {
    const service = await createService({ price: 500 });
    const other = await createService();
    const { accessToken } = await createAndLogin();
    const check = (c: string) =>
      api()
        .post(`${API}/promotions/validate`)
        .set(bearer(accessToken))
        .send({ code: c, serviceId: service.id });

    expect((await check('NOPE123')).body.message).toBe('Invalid promo code');

    const future = (await createPromo({ startsAt: inDays(2), endsAt: inDays(5) })).body.data;
    expect((await check(future.code)).body.message).toMatch(/not active yet/);

    const minOrder = (
      await createPromo({ discountType: 'fixed', discountValue: 50, minOrderAmount: 800 })
    ).body.data;
    expect((await check(minOrder.code)).body.message).toMatch(/Minimum order/);

    const onlyOther = (
      await createPromo({ appliesTo: 'specific_services', serviceIds: [other.id] })
    ).body.data;
    const res = await check(onlyOther.code);
    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe('promoCode');
  });

  it('category promotions cover sub-categories', async () => {
    const parent = await prisma.serviceCategory.create({
      data: { name: `P${Date.now()}`, slug: `p-${Date.now()}` },
    });
    const child = await prisma.serviceCategory.create({
      data: { name: `C${Date.now()}`, slug: `c-${Date.now()}`, parentId: parent.id },
    });
    const service = await createService({ categoryId: child.id, price: 1000 });
    const promo = (
      await createPromo({
        discountType: 'fixed',
        discountValue: 100,
        appliesTo: 'specific_categories',
        categoryIds: [parent.id],
      })
    ).body.data;
    const { accessToken } = await createAndLogin();

    const res = await api()
      .post(`${API}/promotions/validate`)
      .set(bearer(accessToken))
      .send({ code: promo.code, serviceId: service.id })
      .expect(200);
    expect(res.body.data.totalAmount).toBe(900);
  });
});

describe('Promotions — usage', () => {
  it('counts usage per booking, enforces per-user limit and blocks deleting used promos', async () => {
    const { service, customer, pet, date } = await bookableSetup({ price: 1000 });
    const promo = (
      await createPromo({ discountType: 'fixed', discountValue: 100, perUserLimit: 1 })
    ).body.data;

    const first = await bookViaApi(customer.accessToken, {
      serviceId: service.id,
      petId: pet.id,
      date,
      startTime: '09:00',
      promoCode: promo.code,
    }).expect(201);
    expect(first.body.data).toMatchObject({
      discountAmount: '100',
      totalAmount: '900',
      promotion: { code: promo.code },
    });

    const second = await bookViaApi(customer.accessToken, {
      serviceId: service.id,
      petId: pet.id,
      date,
      startTime: '11:00',
      promoCode: promo.code,
    });
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/already used/);

    const stored = await prisma.promotion.findUniqueOrThrow({ where: { id: promo.id } });
    expect(stored.usedCount).toBe(1);

    await api().delete(`${API}/promotions/${promo.id}`).set(bearer(admin)).expect(409);
    const usages = await api()
      .get(`${API}/promotions/${promo.id}/usages`)
      .set(bearer(admin))
      .expect(200);
    expect(usages.body.data[0].booking.bookingNo).toBe(first.body.data.bookingNo);
  });

  it('respects the global usage limit', async () => {
    const promo = (await createPromo({ discountType: 'fixed', discountValue: 10, usageLimit: 1 }))
      .body.data;
    const a = await bookableSetup({ daysAhead: 6 });
    const b = await bookableSetup({ daysAhead: 6 });

    await bookViaApi(a.customer.accessToken, {
      serviceId: a.service.id,
      petId: a.pet.id,
      date: a.date,
      startTime: '09:00',
      promoCode: promo.code,
    }).expect(201);
    const res = await bookViaApi(b.customer.accessToken, {
      serviceId: b.service.id,
      petId: b.pet.id,
      date: b.date,
      startTime: '09:00',
      promoCode: promo.code,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/usage limit/);
  });
});
