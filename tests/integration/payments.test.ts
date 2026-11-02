import { beforeAll, describe, expect, it } from 'vitest';

const { prisma } = await import('@/lib/prisma');
const { emailOutbox } = await import('@/shared/services/email.service');
const { API, api, bearer, bookViaApi, flushEmails, loginAsSuperAdmin } =
  await import('../helpers');
const { bookableSetup } = await import('../helpers/fixtures');

let admin: string;

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
});

/** booking for 1000 BDT, not paid yet */
const newBooking = async () => {
  const setup = await bookableSetup({ price: 1000 });
  const booking = (
    await bookViaApi(setup.customer.accessToken, {
      serviceId: setup.service.id,
      petId: setup.pet.id,
      date: setup.date,
      startTime: '09:00',
    }).expect(201)
  ).body.data;
  return { ...setup, booking };
};

const recordPayment = (bookingId: number, body: Record<string, unknown> = {}) =>
  api()
    .post(`${API}/payments/cash`)
    .set(bearer(admin))
    .send({ bookingId, ...body });

describe('Online payment is switched off', () => {
  it('has no checkout or gateway callback endpoints', async () => {
    const { customer, booking } = await newBooking();

    await api()
      .post(`${API}/payments/init`)
      .set(bearer(customer.accessToken))
      .send({ bookingId: booking.id })
      .expect(404);
    for (const path of ['success', 'fail', 'cancel', 'ipn']) {
      await api().post(`${API}/payments/sslcommerz/${path}`).send({ tran_id: 'X' }).expect(404);
    }
  });

  it('a new booking stays pending and unpaid until staff act on it', async () => {
    const { customer, booking } = await newBooking();
    expect(booking).toMatchObject({ status: 'pending', paymentStatus: 'unpaid' });

    await flushEmails();
    const received = emailOutbox.find(
      (m) => m.template === 'BOOKING_RECEIVED' && m.to.email === customer.user.email,
    );
    expect(received).toBeTruthy();

    // staff confirm it without any payment
    await api()
      .patch(`${API}/bookings/${booking.id}/status`)
      .set(bearer(admin))
      .send({ status: 'confirmed' })
      .expect(200);
    expect(
      await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }),
    ).toMatchObject({ status: 'confirmed', paymentStatus: 'unpaid' });
  });
});

describe('Counter payments & refunds', () => {
  it('records partial cash payments until the booking is paid', async () => {
    const { customer, booking } = await newBooking();

    await recordPayment(booking.id, { amount: 400 }).expect(201);
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).paymentStatus,
    ).toBe('partial');

    await recordPayment(booking.id, { amount: 700 }).expect(400); // more than the 600 due
    const rest = await recordPayment(booking.id).expect(201); // defaults to the due amount
    expect(rest.body.data.amount).toBe('600');

    const b = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(b).toMatchObject({ paymentStatus: 'paid', status: 'confirmed' });
    await recordPayment(booking.id, { amount: 1 }).expect(409);

    await flushEmails();
    expect(
      emailOutbox.filter(
        (m) => m.template === 'PAYMENT_RECEIPT' && m.to.email === customer.user.email,
      ),
    ).toHaveLength(2);
  });

  it('only staff with the payment permission can record one', async () => {
    const { customer, booking } = await newBooking();
    await api()
      .post(`${API}/payments/cash`)
      .set(bearer(customer.accessToken))
      .send({ bookingId: booking.id })
      .expect(403);
  });

  it('refunds a payment partially then fully', async () => {
    const { booking } = await newBooking();
    const payment = (await recordPayment(booking.id, { method: 'mobile_banking' }).expect(201))
      .body.data;

    const refund = (body: Record<string, unknown>) =>
      api()
        .post(`${API}/payments/${payment.id}/refund`)
        .set(bearer(admin))
        .send({ reason: 'Customer request', ...body });

    const partial = await refund({ amount: 300 }).expect(201);
    expect(partial.body.data).toMatchObject({
      type: 'refund',
      status: 'success',
      amount: '300',
      refundOf: { id: payment.id },
    });
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).paymentStatus,
    ).toBe('partial');

    await refund({ amount: 800 }).expect(400);
    await refund({}).expect(201); // the remaining 700

    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
      'refunded',
    );
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).paymentStatus,
    ).toBe('refunded');
    await refund({}).expect(400);
  });
});

describe('Payment lists', () => {
  it('customers see their own payments, admins see everything', async () => {
    const { customer, booking } = await newBooking();
    const payment = (await recordPayment(booking.id).expect(201)).body.data;

    const mine = await api()
      .get(`${API}/me/payments`)
      .set(bearer(customer.accessToken))
      .expect(200);
    expect(mine.body.meta.total).toBe(1);
    expect(mine.body.data[0].booking.bookingNo).toBe(booking.bookingNo);

    const all = await api()
      .get(`${API}/payments`)
      .query({ searchTerm: payment.transactionId, method: 'cash' })
      .set(bearer(admin))
      .expect(200);
    expect(all.body.data).toHaveLength(1);

    // the gateway method is gone from the filter
    await api().get(`${API}/payments`).query({ method: 'sslcommerz' }).set(bearer(admin)).expect(422);
    await api().get(`${API}/payments`).set(bearer(customer.accessToken)).expect(403);
  });
});
