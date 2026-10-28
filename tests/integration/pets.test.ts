import { describe, expect, it } from 'vitest';
import { API, api, bearer, createAndLogin, loginAsSuperAdmin } from '../helpers';
import { createBooking, createService, daysFromToday, petTypeId } from '../helpers/fixtures';

describe('My pets', () => {
  it('lets a customer manage only their own pets', async () => {
    const owner = await createAndLogin();
    const other = await createAndLogin();
    const dogId = await petTypeId('dog');

    const created = await api()
      .post(`${API}/me/pets`)
      .set(bearer(owner.accessToken))
      .send({
        petTypeId: dogId,
        name: 'Tommy',
        breed: 'Labrador',
        size: 'large',
        dateOfBirth: '2022-05-01',
        weightKg: 28.5,
        isVaccinated: true,
      })
      .expect(201);
    const petId = created.body.data.id;
    expect(created.body.data).toMatchObject({
      name: 'Tommy',
      petType: { slug: 'dog' },
      weightKg: '28.5',
    });

    const list = await api().get(`${API}/me/pets`).set(bearer(owner.accessToken)).expect(200);
    expect(list.body.meta.total).toBe(1);

    // someone else's pet looks like it doesn't exist
    await api().get(`${API}/me/pets/${petId}`).set(bearer(other.accessToken)).expect(404);
    await api()
      .patch(`${API}/me/pets/${petId}`)
      .set(bearer(other.accessToken))
      .send({ name: 'X' })
      .expect(404);
    await api().delete(`${API}/me/pets/${petId}`).set(bearer(other.accessToken)).expect(404);

    await api()
      .patch(`${API}/me/pets/${petId}`)
      .set(bearer(owner.accessToken))
      .send({ name: 'Tom' })
      .expect(200);
    await api().delete(`${API}/me/pets/${petId}`).set(bearer(owner.accessToken)).expect(200);
    await api().get(`${API}/me/pets/${petId}`).set(bearer(owner.accessToken)).expect(404);
  });

  it('validates pet type and date of birth', async () => {
    const { accessToken } = await createAndLogin();
    await api()
      .post(`${API}/me/pets`)
      .set(bearer(accessToken))
      .send({ petTypeId: 999999, name: 'Ghost' })
      .expect(400);
    await api()
      .post(`${API}/me/pets`)
      .set(bearer(accessToken))
      .send({ petTypeId: await petTypeId(), name: 'Future', dateOfBirth: '2999-01-01' })
      .expect(422);
  });

  it('cannot delete a pet with an open booking', async () => {
    const { user, accessToken } = await createAndLogin();
    const service = await createService();
    const booking = await createBooking({
      userId: user.id,
      serviceId: service.id,
      date: daysFromToday(2),
      startTime: '10:00',
    });

    await api().delete(`${API}/me/pets/${booking.petId}`).set(bearer(accessToken)).expect(409);
  });
});

describe('Pets (admin)', () => {
  it('admins can search all pets by owner email, customers cannot', async () => {
    const owner = await createAndLogin();
    await api()
      .post(`${API}/me/pets`)
      .set(bearer(owner.accessToken))
      .send({ petTypeId: await petTypeId('cat'), name: 'Mimi' })
      .expect(201);

    const admin = await loginAsSuperAdmin();
    const res = await api()
      .get(`${API}/pets`)
      .query({ searchTerm: owner.user.email })
      .set(bearer(admin.accessToken))
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].user.email).toBe(owner.user.email);

    await api().get(`${API}/pets`).set(bearer(owner.accessToken)).expect(403);
  });
});
