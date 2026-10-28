import { beforeAll, describe, expect, it } from 'vitest';
import { API, api, bearer, createAndLogin, createUser, loginAsSuperAdmin } from '../helpers';
import {
  createBooking,
  createCategory,
  createService,
  daysFromToday,
  petTypeId,
} from '../helpers/fixtures';

let admin: string;
let dog: number;
let cat: number;

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
  dog = await petTypeId('dog');
  cat = await petTypeId('cat');
});

const createViaApi = (body: Record<string, unknown>) =>
  api().post(`${API}/services`).set(bearer(admin)).send(body);

describe('Services', () => {
  it('creates a service with pet types and staff (flattened in the response)', async () => {
    const category = await createCategory();
    const staff = await createUser('staff');

    const res = await createViaApi({
      categoryId: category.id,
      name: 'Full Grooming',
      price: 1500,
      discountPrice: 1200,
      durationMinutes: 90,
      petTypeIds: [dog, cat],
      staffIds: [staff.id],
    }).expect(201);

    expect(res.body.data).toMatchObject({
      price: '1500',
      discountPrice: '1200',
      category: { id: category.id },
      staff: [{ id: staff.id }],
    });
    expect(res.body.data.slug).toMatch(/^full-grooming/);
    expect(res.body.data.petTypes.map((p: { slug: string }) => p.slug).sort()).toEqual([
      'cat',
      'dog',
    ]);
  });

  it('validates business rules', async () => {
    const category = await createCategory();
    const customer = await createUser('customer');
    const base = {
      categoryId: category.id,
      name: 'Bad',
      price: 500,
      durationMinutes: 60,
      petTypeIds: [dog],
    };

    await createViaApi({ ...base, discountPrice: 500 }).expect(422);
    await createViaApi({ ...base, durationMinutes: 62 }).expect(422);
    await createViaApi({ ...base, price: 10.555 }).expect(422);
    await createViaApi({ ...base, petTypeIds: [] }).expect(422);
    await createViaApi({ ...base, staffIds: [customer.id] }).expect(400);
    await createViaApi({ ...base, categoryId: 999999 }).expect(400);
  });

  it('rejects a discount above the stored price on update', async () => {
    const service = await createService({ price: 800 });
    await api()
      .patch(`${API}/services/${service.id}`)
      .set(bearer(admin))
      .send({ discountPrice: 900 })
      .expect(422);
    await api()
      .patch(`${API}/services/${service.id}`)
      .set(bearer(admin))
      .send({ discountPrice: 700 })
      .expect(200);
  });

  it('filters by category slug, pet type, price range and search', async () => {
    const category = await createCategory();
    const tag = `Zebra${Date.now()}`;
    await createService({
      categoryId: category.id,
      name: `${tag} Dog Wash`,
      price: 500,
      petTypeSlugs: ['dog'],
    });
    await createService({
      categoryId: category.id,
      name: `${tag} Cat Wash`,
      price: 700,
      petTypeSlugs: ['cat'],
    });
    await createService({
      categoryId: category.id,
      name: `${tag} Premium`,
      price: 3000,
      petTypeSlugs: ['dog', 'cat'],
    });
    await createService({
      categoryId: category.id,
      name: `${tag} Hidden`,
      price: 600,
      status: 'inactive',
    });

    const q = (params: Record<string, unknown>) =>
      api()
        .get(`${API}/services`)
        .query({ category: category.slug, limit: 50, ...params })
        .expect(200);

    expect((await q({})).body.meta.total).toBe(3); // inactive hidden from public
    expect((await q({ petType: 'cat' })).body.meta.total).toBe(2);
    expect(
      (await q({ petTypeId: dog, maxPrice: 1000 })).body.data.map((s: { name: string }) => s.name),
    ).toEqual([`${tag} Dog Wash`]);
    expect((await q({ searchTerm: 'premium' })).body.meta.total).toBe(1);

    const sorted = await q({ sortBy: 'price', sortOrder: 'desc' });
    expect(sorted.body.data.map((s: { price: string }) => s.price)).toEqual(['3000', '700', '500']);

    // admins see the inactive one too
    const adm = await api()
      .get(`${API}/services`)
      .query({ category: category.slug })
      .set(bearer(admin))
      .expect(200);
    expect(adm.body.meta.total).toBe(4);
  });

  it('hides inactive services and services in inactive categories from the public', async () => {
    const service = await createService();
    await api().get(`${API}/services/${service.slug}`).expect(200);

    await api()
      .patch(`${API}/services/${service.id}/status`)
      .set(bearer(admin))
      .send({ status: 'inactive' })
      .expect(200);
    await api().get(`${API}/services/${service.slug}`).expect(404);
    await api().get(`${API}/services/${service.slug}`).set(bearer(admin)).expect(200);

    const hiddenCategory = await createCategory({ status: 'inactive' });
    const inHidden = await createService({ categoryId: hiddenCategory.id });
    await api().get(`${API}/services/${inHidden.id}`).expect(404);
  });

  it('replaces pet types and staff', async () => {
    const service = await createService({ petTypeSlugs: ['dog'] });
    const staff = await createUser('staff');

    const pets = await api()
      .put(`${API}/services/${service.id}/pet-types`)
      .set(bearer(admin))
      .send({ petTypeIds: [cat] })
      .expect(200);
    expect(pets.body.data.petTypes.map((p: { slug: string }) => p.slug)).toEqual(['cat']);

    const team = await api()
      .put(`${API}/services/${service.id}/staff`)
      .set(bearer(admin))
      .send({ staffIds: [staff.id] })
      .expect(200);
    expect(team.body.data.staff.map((s: { id: number }) => s.id)).toEqual([staff.id]);
  });

  it('customers cannot manage services', async () => {
    const { accessToken } = await createAndLogin();
    await api().post(`${API}/services`).set(bearer(accessToken)).send({}).expect(403);
  });

  it('blocks deleting a service with open bookings', async () => {
    const service = await createService();
    const customer = await createUser('customer');
    await createBooking({
      userId: customer.id,
      serviceId: service.id,
      date: daysFromToday(3),
      startTime: '10:00',
    });

    await api().delete(`${API}/services/${service.id}`).set(bearer(admin)).expect(409);
    // duration can't change either while bookings are open
    await api()
      .patch(`${API}/services/${service.id}`)
      .set(bearer(admin))
      .send({ durationMinutes: 30 })
      .expect(409);
  });
});
