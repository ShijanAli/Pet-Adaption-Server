import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/* SSLCommerz is mocked — the tests control what "the gateway" answers */
const gateway = vi.hoisted(() => ({
  validations: new Map<string, Record<string, unknown>>(),
  refundStatus: 'success' as string,
}));

vi.mock('@/lib/sslcommerz', () => ({
  isSslcommerzConfigured: () => true,
  sslcommerz: {
    initSession: vi.fn(async (input: { tranId: string }) => ({
      gatewayUrl: `https://sandbox.sslcommerz.com/EasyCheckOut/${input.tranId}`,
      sessionKey: 'SESSION',
    })),
    validate: vi.fn(
      async (valId: string) => gateway.validations.get(valId) ?? { status: 'INVALID_TRANSACTION' },
    ),
    refund: vi.fn(async () => ({
      APIConnect: 'DONE',
      status: gateway.refundStatus,
      refund_ref_id: 'REF1',
    })),
  },
}));

const { prisma } = await import('@/lib/prisma');
const { emailOutbox } = await import('@/shared/services/email.service');
const { API, api, bearer, bookViaApi, createAndLogin, flushEmails, loginAsSuperAdmin } =
  await import('../helpers');
const { bookableSetup } = await import('../helpers/fixtures');

let admin: string;

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
});

beforeEach(() => {
  gateway.refundStatus = 'success';
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

const initPayment = (token: string, bookingId: number, currency = 'BDT') =>
  api().post(`${API}/payments/init`).set(bearer(token)).send({ bookingId, currency });

/** Simulates SSLCommerz posting the success form back to us */
const gatewayPost = (path: string, fields: Record<string, string>) =>
  api().post(`${API}/payments/sslcommerz/${path}`).type('form').send(fields);

const approve = (
  tranId: string,
  amount: string,
  currency = 'BDT',
  overrides: Record<string, unknown> = {},
) => {
  const valId = `VAL-${tranId}`;
  gateway.validations.set(valId, {
    status: 'VALID',
    tran_id: tranId,
    val_id: valId,
    amount,
    currency: 'BDT',
    currency_type: currency,
    currency_amount: amount,
    bank_tran_id: `BANK-${tranId}`,
    ...overrides,
  });
  return valId;
};

describe('Online payment (SSLCommerz)', () => {
  it('creates a session for the due amount in BDT or USD', async () => {
    const { customer, booking } = await newBooking();

    const bdt = await initPayment(customer.accessToken, booking.id).expect(201);
    expect(bdt.body.data).toMatchObject({ amount: 1000, currency: 'BDT' });
    expect(bdt.body.data.gatewayUrl).toContain(bdt.body.data.transactionId);

    const usd = await initPayment(customer.accessToken, booking.id, 'USD').expect(201);
    expect(usd.body.data).toMatchObject({ amount: 8.2, currency: 'USD' }); // 1000 / 122

    const stored = await prisma.payment.findUniqueOrThrow({
      where: { id: usd.body.data.paymentId },
    });
    expect(stored).toMatchObject({ status: 'pending', method: 'sslcommerz' });
    expect(Number(stored.baseAmount)).toBe(1000);

    const stranger = await createAndLogin();
    await initPayment(stranger.accessToken, booking.id).expect(404);
  });

  it('verifies the payment, confirms the booking and redirects to the frontend (idempotent)', async () => {
    const { customer, booking } = await newBooking();
    const { transactionId } = (await initPayment(customer.accessToken, booking.id).expect(201)).body
      .data;
    const valId = approve(transactionId, '1000.00');

    const res = await gatewayPost('success', {
      tran_id: transactionId,
      val_id: valId,
      status: 'VALID',
    }).expect(303);
    expect(res.headers.location).toBe(
      `http://localhost:3000/payment/success?tranId=${transactionId}&reference=${booking.bookingNo}&bookingNo=${booking.bookingNo}`,
    );

    const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(updated).toMatchObject({ status: 'confirmed', paymentStatus: 'paid' });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { transactionId } });
    expect(payment).toMatchObject({ status: 'success', bankTranId: `BANK-${transactionId}` });

    // IPN arrives afterwards → nothing changes twice
    await gatewayPost('ipn', { tran_id: transactionId, val_id: valId, status: 'VALID' }).expect(
      200,
    );
    const logs = await prisma.bookingStatusLog.count({
      where: { bookingId: booking.id, toStatus: 'confirmed' },
    });
    expect(logs).toBe(1);

    await flushEmails();
    expect(
      emailOutbox.filter(
        (m) => m.template === 'PAYMENT_RECEIPT' && m.to.email === customer.user.email,
      ),
    ).toHaveLength(1);

    // nothing left to pay
    await initPayment(customer.accessToken, booking.id).expect(409);
  });

  it('rejects a tampered amount', async () => {
    const { customer, booking } = await newBooking();
    const { transactionId } = (await initPayment(customer.accessToken, booking.id).expect(201)).body
      .data;
    const valId = approve(transactionId, '10.00');

    const res = await gatewayPost('success', { tran_id: transactionId, val_id: valId }).expect(303);
    expect(res.headers.location).toContain('/payment/failed');

    expect((await prisma.payment.findUniqueOrThrow({ where: { transactionId } })).status).toBe(
      'failed',
    );
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).paymentStatus,
    ).toBe('unpaid');
  });

  it('handles fail / cancel callbacks', async () => {
    const { customer, booking } = await newBooking();
    const a = (await initPayment(customer.accessToken, booking.id).expect(201)).body.data
      .transactionId;
    const b = (await initPayment(customer.accessToken, booking.id).expect(201)).body.data
      .transactionId;

    expect(
      (await gatewayPost('fail', { tran_id: a, status: 'FAILED' }).expect(303)).headers.location,
    ).toContain('/payment/failed');
    expect(
      (await gatewayPost('cancel', { tran_id: b, status: 'CANCELLED' }).expect(303)).headers
        .location,
    ).toContain('/payment/cancelled');

    const statuses = await prisma.payment.findMany({
      where: { transactionId: { in: [a, b] } },
      select: { transactionId: true, status: true },
    });
    expect(Object.fromEntries(statuses.map((p) => [p.transactionId, p.status]))).toEqual({
      [a]: 'failed',
      [b]: 'cancelled',
    });
  });
});

describe('Counter payments & refunds', () => {
  it('records partial cash payments until the booking is paid', async () => {
    const { booking } = await newBooking();
    const pay = (amount?: number) =>
      api()
        .post(`${API}/payments/cash`)
        .set(bearer(admin))
        .send({ bookingId: booking.id, ...(amount && { amount }) });

    await pay(400).expect(201);
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).paymentStatus,
    ).toBe('partial');

    await pay(700).expect(400); // more than the 600 due
    const rest = await pay().expect(201); // defaults to the due amount
    expect(rest.body.data.amount).toBe('600');

    const b = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(b).toMatchObject({ paymentStatus: 'paid', status: 'confirmed' });
    await pay(1).expect(409);
  });

  it('refunds online payments partially then fully', async () => {
    const { customer, booking } = await newBooking();
    const { transactionId } = (await initPayment(customer.accessToken, booking.id).expect(201)).body
      .data;
    await gatewayPost('success', {
      tran_id: transactionId,
      val_id: approve(transactionId, '1000.00'),
    }).expect(303);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { transactionId } });

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

  it('reports gateway refund rejections', async () => {
    const { customer, booking } = await newBooking();
    const { transactionId } = (await initPayment(customer.accessToken, booking.id).expect(201)).body
      .data;
    await gatewayPost('success', {
      tran_id: transactionId,
      val_id: approve(transactionId, '1000.00'),
    }).expect(303);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { transactionId } });

    gateway.refundStatus = 'failed';
    await api()
      .post(`${API}/payments/${payment.id}/refund`)
      .set(bearer(admin))
      .send({ reason: 'Test' })
      .expect(502);
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).paymentStatus,
    ).toBe('paid');
  });
});

describe('Payment lists', () => {
  it('customers see their own payments without gateway internals', async () => {
    const { customer, booking } = await newBooking();
    const { transactionId } = (await initPayment(customer.accessToken, booking.id).expect(201)).body
      .data;
    await gatewayPost('success', {
      tran_id: transactionId,
      val_id: approve(transactionId, '1000.00'),
    }).expect(303);

    const mine = await api()
      .get(`${API}/me/payments`)
      .set(bearer(customer.accessToken))
      .expect(200);
    expect(mine.body.meta.total).toBe(1);
    expect(mine.body.data[0].gatewayResponse).toBeUndefined();
    expect(mine.body.data[0].booking.bookingNo).toBe(booking.bookingNo);

    const all = await api()
      .get(`${API}/payments`)
      .query({ searchTerm: transactionId })
      .set(bearer(admin))
      .expect(200);
    expect(all.body.data[0].gatewayResponse).toBeTruthy();

    await api().get(`${API}/payments`).set(bearer(customer.accessToken)).expect(403);
  });
});
