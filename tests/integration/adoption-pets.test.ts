import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { API, api, bearer, createAndLogin, loginAsSuperAdmin } from '../helpers';
import { applicationBody, createAdoptionPet, petTypeId } from '../helpers/fixtures';

let admin: string;
const img = (n: number) => ({
  imageUrl: `https://res.cloudinary.com/demo/image/upload/pet-${n}.jpg`,
});

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
});

describe('Adoption pets', () => {
  it('lists a pet with images (first image becomes the cover)', async () => {
    const res = await api()
      .post(`${API}/adoption-pets`)
      .set(bearer(admin))
      .send({
        petTypeId: await petTypeId('cat'),
        name: 'Luna',
        gender: 'female',
        ageMonths: 8,
        description: 'Playful kitten, litter trained and very curious.',
        adoptionFee: 1500,
        isVaccinated: true,
        images: [img(1), img(2)],
      })
      .expect(201);

    expect(res.body.data).toMatchObject({
      status: 'available',
      adoptionFee: '1500',
      petType: { slug: 'cat' },
    });
    expect(res.body.data.slug).toMatch(/^luna/);
    expect(res.body.data.images.map((i: { isPrimary: boolean }) => i.isPrimary)).toEqual([
      true,
      false,
    ]);
  });

  it('filters the public list and hides on-hold / adopted pets', async () => {
    const tag = `Zz${Date.now()}`;
    const kitten = await createAdoptionPet({
      name: `${tag} kitten`,
      petTypeSlug: 'cat',
      ageMonths: 3,
      gender: 'female',
    });
    await createAdoptionPet({
      name: `${tag} senior`,
      petTypeSlug: 'dog',
      ageMonths: 96,
      adoptionFee: 3000,
    });
    const hold = await createAdoptionPet({ name: `${tag} hold`, status: 'on_hold' });
    await createAdoptionPet({ name: `${tag} gone`, status: 'adopted' });

    const q = (params: Record<string, unknown>) =>
      api()
        .get(`${API}/adoption-pets`)
        .query({ searchTerm: tag, limit: 50, ...params })
        .expect(200);

    expect((await q({})).body.meta.total).toBe(2);
    expect((await q({ petType: 'cat' })).body.data.map((p: { id: number }) => p.id)).toEqual([
      kitten.id,
    ]);
    expect((await q({ maxAgeMonths: 12, gender: 'female' })).body.meta.total).toBe(1);
    expect((await q({ maxFee: 1000 })).body.meta.total).toBe(1);
    expect((await q({ status: 'adopted' })).body.meta.total).toBe(2); // public can't ask for adopted

    await api().get(`${API}/adoption-pets/${hold.slug}`).expect(404);

    const adm = await api()
      .get(`${API}/adoption-pets`)
      .query({ searchTerm: tag })
      .set(bearer(admin))
      .expect(200);
    expect(adm.body.meta.total).toBe(4);
  });

  it('manages status and images', async () => {
    const pet = await createAdoptionPet();
    const url = `${API}/adoption-pets/${pet.id}`;

    await api().patch(`${url}/status`).set(bearer(admin)).send({ status: 'on_hold' }).expect(200);
    await api().patch(`${url}/status`).set(bearer(admin)).send({ status: 'adopted' }).expect(422);
    await api().patch(`${url}/status`).set(bearer(admin)).send({ status: 'available' }).expect(200);

    const added = await api()
      .post(`${url}/images`)
      .set(bearer(admin))
      .send({ images: [img(1), img(2), img(3)] })
      .expect(201);
    const [first, second] = added.body.data.images;
    expect(first.isPrimary).toBe(true);

    await api().patch(`${url}/images/${second.id}/primary`).set(bearer(admin)).expect(200);
    const afterDelete = await api()
      .delete(`${url}/images/${second.id}`)
      .set(bearer(admin))
      .expect(200);
    expect(
      afterDelete.body.data.images.filter((i: { isPrimary: boolean }) => i.isPrimary),
    ).toHaveLength(1);

    await api()
      .post(`${url}/images`)
      .set(bearer(admin))
      .send({ images: Array.from({ length: 9 }, (_, i) => img(i)) })
      .expect(400);
  });

  it('cannot delete a pet with open applications', async () => {
    const pet = await createAdoptionPet();
    const { accessToken } = await createAndLogin();
    await api()
      .post(`${API}/adoption-applications`)
      .set(bearer(accessToken))
      .send(applicationBody(pet.id))
      .expect(201);

    await api().delete(`${API}/adoption-pets/${pet.id}`).set(bearer(admin)).expect(409);

    const free = await createAdoptionPet();
    await api().delete(`${API}/adoption-pets/${free.id}`).set(bearer(admin)).expect(200);
    expect(
      await prisma.adoptionPet.findFirst({ where: { id: free.id, deletedAt: { not: null } } }),
    ).not.toBeNull();
  });

  it('customers cannot manage adoption pets', async () => {
    const { accessToken } = await createAndLogin();
    await api().post(`${API}/adoption-pets`).set(bearer(accessToken)).send({}).expect(403);
  });
});

describe('Favorites', () => {
  it('adds idempotently, flags isFavorite and removes', async () => {
    const pet = await createAdoptionPet();
    const { accessToken } = await createAndLogin();
    const fav = `${API}/me/favorites/${pet.id}`;

    await api().put(fav).set(bearer(accessToken)).expect(200);
    await api().put(fav).set(bearer(accessToken)).expect(200);

    const list = await api().get(`${API}/me/favorites`).set(bearer(accessToken)).expect(200);
    expect(list.body.data.map((p: { id: number }) => p.id)).toEqual([pet.id]);

    const detail = await api()
      .get(`${API}/adoption-pets/${pet.id}`)
      .set(bearer(accessToken))
      .expect(200);
    expect(detail.body.data.isFavorite).toBe(true);
    const anonymous = await api().get(`${API}/adoption-pets/${pet.id}`).expect(200);
    expect(anonymous.body.data.isFavorite).toBe(false);

    await api().delete(fav).set(bearer(accessToken)).expect(200);
    expect((await api().get(`${API}/me/favorites`).set(bearer(accessToken))).body.meta.total).toBe(
      0,
    );

    const hidden = await createAdoptionPet({ status: 'on_hold' });
    await api().put(`${API}/me/favorites/${hidden.id}`).set(bearer(accessToken)).expect(404);
  });
});
