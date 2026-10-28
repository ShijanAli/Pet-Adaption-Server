import { beforeAll, describe, expect, it, vi } from 'vitest';

/* SSLCommerz mocked — every validation is "VALID" for the amount we registered */
const gateway = vi.hoisted(() => ({ validations: new Map<string, Record<string, unknown>>() }));
vi.mock('@/lib/sslcommerz', () => ({
  isSslcommerzConfigured: () => true,
  sslcommerz: {
    initSession: vi.fn(async (input: { tranId: string }) => ({
      gatewayUrl: `https://sandbox/pay/${input.tranId}`,
    })),
    validate: vi.fn(
      async (valId: string) => gateway.validations.get(valId) ?? { status: 'INVALID_TRANSACTION' },
    ),
    refund: vi.fn(async () => ({ APIConnect: 'DONE', status: 'success' })),
  },
}));

const { prisma } = await import('@/lib/prisma');
const { emailOutbox } = await import('@/shared/services/email.service');
const { API, api, bearer, createAndLogin, flushEmails, loginAsSuperAdmin } =
  await import('../helpers');
const { applicationBody, createAdoptionPet } = await import('../helpers/fixtures');

let admin: string;

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
});

const apply = (token: string, petId: number, extra: Record<string, unknown> = {}) =>
  api().post(`${API}/adoption-applications`).set(bearer(token)).send(applicationBody(petId, extra));

const review = (id: number, status: string, adminNote?: string) =>
  api()
    .patch(`${API}/adoption-applications/${id}/review`)
    .set(bearer(admin))
    .send({ status, adminNote });

describe('Applying', () => {
  it('validates the application', async () => {
    const pet = await createAdoptionPet();
    const { accessToken } = await createAndLogin();

    await apply(accessToken, pet.id, { hasOtherPets: true }).expect(422);
    await apply(accessToken, pet.id, { reason: 'short' }).expect(422);

    const ok = await apply(accessToken, pet.id, {
      hasOtherPets: true,
      otherPetsDetails: 'One calm cat',
    }).expect(201);
    expect(ok.body.data).toMatchObject({ status: 'pending', adoptionPet: { id: pet.id } });
    expect(ok.body.data.applicationNo).toMatch(/^AD-/);

    await apply(accessToken, pet.id).expect(409); // one open application per pet

    const onHold = await createAdoptionPet({ status: 'on_hold' });
    await apply(accessToken, onHold.id).expect(400);
  });

  it('lets applicants track and withdraw their own applications', async () => {
    const pet = await createAdoptionPet();
    const me = await createAndLogin();
    const other = await createAndLogin();
    const app = (await apply(me.accessToken, pet.id).expect(201)).body.data;

    await api()
      .get(`${API}/me/adoption-applications/${app.applicationNo}`)
      .set(bearer(me.accessToken))
      .expect(200);
    await api()
      .get(`${API}/me/adoption-applications/${app.id}`)
      .set(bearer(other.accessToken))
      .expect(404);

    await api()
      .patch(`${API}/me/adoption-applications/${app.id}/cancel`)
      .set(bearer(me.accessToken))
      .send({})
      .expect(200);
    await api()
      .patch(`${API}/me/adoption-applications/${app.id}/cancel`)
      .set(bearer(me.accessToken))
      .send({})
      .expect(400);

    // can apply again after withdrawing
    await apply(me.accessToken, pet.id).expect(201);
  });
});

describe('Review → payment → handover', () => {
  it('runs the full adoption with an online fee payment', async () => {
    const pet = await createAdoptionPet({ adoptionFee: 2000 });
    const alice = await createAndLogin();
    const bob = await createAndLogin();
    const a = (await apply(alice.accessToken, pet.id).expect(201)).body.data;
    const b = (await apply(bob.accessToken, pet.id).expect(201)).body.data;

    // customers can't review
    await api()
      .patch(`${API}/adoption-applications/${a.id}/review`)
      .set(bearer(alice.accessToken))
      .send({ status: 'approved' })
      .expect(403);

    await review(a.id, 'under_review').expect(200);
    const approved = await review(a.id, 'approved', 'Home visit went great').expect(200);
    expect(approved.body.data).toMatchObject({
      status: 'approved',
      adoption: { status: 'in_progress', feeAmount: '2000' },
    });

    // pet locked, competitor auto-rejected
    expect((await prisma.adoptionPet.findUniqueOrThrow({ where: { id: pet.id } })).status).toBe(
      'pending',
    );
    expect(
      (await prisma.adoptionApplication.findUniqueOrThrow({ where: { id: b.id } })).status,
    ).toBe('rejected');
    await review(b.id, 'approved').expect(400);
    await apply(bob.accessToken, pet.id).expect(400);

    await flushEmails();
    const bobMail = emailOutbox.find(
      (m) => m.to.email === bob.user.email && m.template === 'ADOPTION_APPLICATION_STATUS',
    );
    expect(bobMail?.subject).toMatch(/rejected/);

    const adoptionId = approved.body.data.adoption.id;
    // handover blocked until the fee is paid
    const early = await api()
      .patch(`${API}/adoptions/${adoptionId}/complete`)
      .set(bearer(admin))
      .send({});
    expect(early.status).toBe(400);
    expect(early.body.message).toMatch(/due 2000/);

    // Alice pays online
    const init = await api()
      .post(`${API}/payments/init`)
      .set(bearer(alice.accessToken))
      .send({ adoptionId })
      .expect(201);
    expect(init.body.data).toMatchObject({ amount: 2000, reference: a.applicationNo });
    const tranId = init.body.data.transactionId;
    gateway.validations.set(`V-${tranId}`, {
      status: 'VALID',
      tran_id: tranId,
      val_id: `V-${tranId}`,
      amount: '2000.00',
      currency: 'BDT',
      currency_type: 'BDT',
      currency_amount: '2000.00',
      bank_tran_id: 'B1',
    });
    const cb = await api()
      .post(`${API}/payments/sslcommerz/success`)
      .type('form')
      .send({ tran_id: tranId, val_id: `V-${tranId}` })
      .expect(303);
    expect(cb.headers.location).toContain(`applicationNo=${a.applicationNo}`);

    const mine = await api()
      .get(`${API}/me/adoptions/${adoptionId}`)
      .set(bearer(alice.accessToken))
      .expect(200);
    expect(mine.body.data).toMatchObject({ feePaid: '2000', feeDue: 0 });
    // someone else's adoption is invisible
    await api().get(`${API}/me/adoptions/${adoptionId}`).set(bearer(bob.accessToken)).expect(404);

    const done = await api()
      .patch(`${API}/adoptions/${adoptionId}/complete`)
      .set(bearer(admin))
      .send({ contractFile: 'https://res.cloudinary.com/demo/raw/upload/contract.pdf' })
      .expect(200);
    expect(done.body.data.status).toBe('completed');
    expect((await prisma.adoptionPet.findUniqueOrThrow({ where: { id: pet.id } })).status).toBe(
      'adopted',
    );
    await api().get(`${API}/adoption-pets/${pet.id}`).expect(404); // no longer public

    await flushEmails();
    expect(
      emailOutbox.some(
        (m) => m.to.email === alice.user.email && m.template === 'ADOPTION_COMPLETED',
      ),
    ).toBe(true);
    await api()
      .patch(`${API}/adoptions/${adoptionId}/complete`)
      .set(bearer(admin))
      .send({})
      .expect(409);
  });

  it('free adoptions can be completed right after approval', async () => {
    const pet = await createAdoptionPet({ adoptionFee: 0 });
    const { accessToken } = await createAndLogin();
    const app = (await apply(accessToken, pet.id).expect(201)).body.data;
    const adoptionId = (await review(app.id, 'approved').expect(200)).body.data.adoption.id;

    await api()
      .post(`${API}/payments/init`)
      .set(bearer(accessToken))
      .send({ adoptionId })
      .expect(409);
    await api()
      .patch(`${API}/adoptions/${adoptionId}/complete`)
      .set(bearer(admin))
      .send({})
      .expect(200);
  });

  it('cancelling an adoption requires refunding first, then frees the pet', async () => {
    const pet = await createAdoptionPet({ adoptionFee: 500 });
    const { accessToken } = await createAndLogin();
    const app = (await apply(accessToken, pet.id).expect(201)).body.data;
    const adoptionId = (await review(app.id, 'approved').expect(200)).body.data.adoption.id;

    const cash = await api()
      .post(`${API}/payments/cash`)
      .set(bearer(admin))
      .send({ adoptionId, amount: 200 })
      .expect(201);
    expect(
      (await prisma.adoption.findUniqueOrThrow({ where: { id: adoptionId } })).feePaid.toString(),
    ).toBe('200');

    await api()
      .patch(`${API}/adoptions/${adoptionId}/cancel`)
      .set(bearer(admin))
      .send({ reason: 'Family moved abroad' })
      .expect(409);

    await api()
      .post(`${API}/payments/${cash.body.data.id}/refund`)
      .set(bearer(admin))
      .send({ reason: 'Adoption cancelled' })
      .expect(201);
    const cancelled = await api()
      .patch(`${API}/adoptions/${adoptionId}/cancel`)
      .set(bearer(admin))
      .send({ reason: 'Family moved abroad' })
      .expect(200);
    expect(cancelled.body.data).toMatchObject({ status: 'cancelled', feePaid: '0' });

    expect((await prisma.adoptionPet.findUniqueOrThrow({ where: { id: pet.id } })).status).toBe(
      'available',
    );
    expect(
      (await prisma.adoptionApplication.findUniqueOrThrow({ where: { id: app.id } })).status,
    ).toBe('cancelled');
  });

  it('only one of two simultaneous approvals for the same pet succeeds', async () => {
    const pet = await createAdoptionPet();
    const x = await createAndLogin();
    const y = await createAndLogin();
    const ax = (await apply(x.accessToken, pet.id).expect(201)).body.data;
    const ay = (await apply(y.accessToken, pet.id).expect(201)).body.data;

    const results = await Promise.all([review(ax.id, 'approved'), review(ay.id, 'approved')]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.adoption.count({ where: { adoptionPetId: pet.id } })).toBe(1);
  });

  it('admin lists support filters', async () => {
    const pet = await createAdoptionPet();
    const { accessToken, user } = await createAndLogin();
    await apply(accessToken, pet.id).expect(201);

    const apps = await api()
      .get(`${API}/adoption-applications`)
      .query({ searchTerm: user.email, status: 'pending' })
      .set(bearer(admin))
      .expect(200);
    expect(apps.body.meta.total).toBe(1);
    expect(apps.body.data[0].user.email).toBe(user.email);

    await api().get(`${API}/adoptions?status=completed`).set(bearer(admin)).expect(200);
    await api().get(`${API}/adoptions`).set(bearer(accessToken)).expect(403);
  });
});
