import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { API, api, bearer, createAndLogin, loginAsSuperAdmin } from '../helpers';

let admin: string;

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
});

describe('Pet types', () => {
  it('public sees only active types, admins can see inactive ones', async () => {
    const created = await api()
      .post(`${API}/pet-types`)
      .set(bearer(admin))
      .send({ name: `Hamster ${Date.now()}`, status: 'inactive' })
      .expect(201);
    const { id, slug } = created.body.data;
    expect(slug).toMatch(/^hamster-\d+$/);

    const pub = await api().get(`${API}/pet-types?limit=100`).expect(200);
    expect(pub.body.data.every((t: { status: string }) => t.status === 'active')).toBe(true);
    expect(pub.body.data.find((t: { id: number }) => t.id === id)).toBeUndefined();
    await api().get(`${API}/pet-types/${slug}`).expect(404);

    const adm = await api().get(`${API}/pet-types?status=inactive`).set(bearer(admin)).expect(200);
    expect(adm.body.data.some((t: { id: number }) => t.id === id)).toBe(true);
    await api().get(`${API}/pet-types/${id}`).set(bearer(admin)).expect(200);
  });

  it('gets an active type by slug', async () => {
    const res = await api().get(`${API}/pet-types/dog`).expect(200);
    expect(res.body.data.name).toBe('Dog');
  });

  it('customers cannot manage pet types', async () => {
    const { accessToken } = await createAndLogin();
    await api()
      .post(`${API}/pet-types`)
      .set(bearer(accessToken))
      .send({ name: 'Snake' })
      .expect(403);
  });

  it('refuses to delete a pet type that is in use', async () => {
    const created = await api()
      .post(`${API}/pet-types`)
      .set(bearer(admin))
      .send({ name: `Turtle ${Date.now()}` })
      .expect(201);
    const { user } = await createAndLogin();
    await prisma.pet.create({
      data: { userId: user.id, petTypeId: created.body.data.id, name: 'Shelly' },
    });

    await api().delete(`${API}/pet-types/${created.body.data.id}`).set(bearer(admin)).expect(409);
  });

  it('deletes an unused pet type', async () => {
    const created = await api()
      .post(`${API}/pet-types`)
      .set(bearer(admin))
      .send({ name: `Ferret ${Date.now()}` })
      .expect(201);
    await api().delete(`${API}/pet-types/${created.body.data.id}`).set(bearer(admin)).expect(200);
  });
});
