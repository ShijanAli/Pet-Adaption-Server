import type { Payment, PaymentStatus, TransactionStatus } from '@generated/prisma/client';
import { logger } from '@/lib/logger';
import { prisma, type TransactionClient } from '@/lib/prisma';
import { sslcommerz } from '@/lib/sslcommerz';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { emailService } from '@/shared/services/email.service';
import { notificationService } from '@/shared/services/notification.service';
import { settingsService } from '@/shared/services/settings.service';
import { generateReferenceNo } from '@/shared/utils/common';
import { formatMoney, round2, sumBy, toNumber } from '@/shared/utils/money';
import type { AuthUser } from '@/shared/types/auth';
import {
  adminPaymentQueryConfig,
  GATEWAY_VALID_STATUSES,
  myPaymentOmit,
  myPaymentQueryConfig,
  PAYABLE_BOOKING_STATUSES,
  paymentInclude,
} from './payments.constant';
import type {
  CashPaymentInput,
  GatewayCallback,
  InitPaymentInput,
  PaymentListQuery,
  RefundInput,
} from './payments.validation';

type Db = TransactionClient | typeof prisma;

/* ───────────────────────── payable abstraction ─────────────────────────
 * Anything that can be paid for (a booking or an adoption fee) is turned into a
 * `Payable`, so init / cash / refund / sync share one implementation.
 */

type PayableRef = { bookingId?: number | null; adoptionId?: number | null };

type Payable = {
  /** Foreign key written on the payment row */
  link: { bookingId: number } | { adoptionId: number };
  userId: number;
  total: number;
  reference: string;
  productName: string;
  productCategory: string;
  customer: { phone: string | null; address: string | null };
};

const customerSelect = { select: { id: true, phone: true, address: true } } as const;

const loadPayable = async (ref: PayableRef, ownerId?: number): Promise<Payable> => {
  const owner = ownerId ? { userId: ownerId } : {};

  if (ref.bookingId) {
    const booking = await prisma.booking.findFirst({
      where: { id: ref.bookingId, ...owner },
      include: { user: customerSelect, service: { select: { name: true } } },
    });
    if (!booking) throw AppError.notFound('Booking');
    if (!(PAYABLE_BOOKING_STATUSES as readonly string[]).includes(booking.status)) {
      throw AppError.badRequest(`A ${booking.status.replace('_', ' ')} booking cannot be paid`);
    }
    return {
      link: { bookingId: booking.id },
      userId: booking.userId,
      total: toNumber(booking.totalAmount),
      reference: booking.bookingNo,
      productName: `${booking.service.name} (${booking.bookingNo})`,
      productCategory: 'pet-care-service',
      customer: booking.user,
    };
  }

  const adoption = await prisma.adoption.findFirst({
    where: { id: ref.adoptionId ?? -1, ...owner },
    include: {
      user: customerSelect,
      adoptionPet: { select: { name: true } },
      application: { select: { applicationNo: true } },
    },
  });
  if (!adoption) throw AppError.notFound('Adoption');
  if (adoption.status !== 'in_progress') {
    throw AppError.badRequest(`A ${adoption.status.replace('_', ' ')} adoption cannot be paid`);
  }
  return {
    link: { adoptionId: adoption.id },
    userId: adoption.userId,
    total: toNumber(adoption.feeAmount),
    reference: adoption.application.applicationNo,
    productName: `Adoption fee — ${adoption.adoptionPet.name}`,
    productCategory: 'adoption-fee',
    customer: adoption.user,
  };
};

/** Money received for a booking / adoption in BDT (payments − refunds) */
const netPaid = async (db: Db, link: Payable['link']) => {
  const rows = await db.payment.findMany({
    where: { ...link, status: { in: ['success', 'refunded'] } },
    select: { type: true, baseAmount: true, status: true },
  });
  const paid = sumBy(
    rows.filter((r) => r.type === 'payment'),
    (r) => toNumber(r.baseAmount),
  );
  const refunded = sumBy(
    rows.filter((r) => r.type === 'refund' && r.status === 'success'),
    (r) => toNumber(r.baseAmount),
  );
  return { paid, refunded, net: round2(paid - refunded) };
};

const dueAmount = async (payable: Payable) =>
  round2(payable.total - (await netPaid(prisma, payable.link)).paid);

/**
 * Booking: recalculates paymentStatus and auto-confirms a pending booking once fully paid.
 */
const syncBooking = async (tx: TransactionClient, bookingId: number, actorId: number | null) => {
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const { paid, refunded, net } = await netPaid(tx, { bookingId });
  const total = toNumber(booking.totalAmount);

  const paymentStatus: PaymentStatus =
    refunded > 0 && net <= 0 ? 'refunded' : net >= total ? 'paid' : net > 0 ? 'partial' : 'unpaid';

  const autoConfirm = booking.status === 'pending' && paymentStatus === 'paid' && paid > 0;
  await tx.booking.update({
    where: { id: bookingId },
    data: { paymentStatus, ...(autoConfirm && { status: 'confirmed' }) },
  });
  if (autoConfirm) {
    await tx.bookingStatusLog.create({
      data: {
        bookingId,
        fromStatus: 'pending',
        toStatus: 'confirmed',
        changedById: actorId,
        note: 'Confirmed after full payment',
      },
    });
  }
};

/** Adoption: keeps `feePaid` equal to the net amount received */
const syncAdoption = async (tx: TransactionClient, adoptionId: number) => {
  const { net } = await netPaid(tx, { adoptionId });
  await tx.adoption.update({ where: { id: adoptionId }, data: { feePaid: Math.max(0, net) } });
};

const syncPayable = (tx: TransactionClient, ref: PayableRef, actorId: number | null) =>
  ref.bookingId
    ? syncBooking(tx, ref.bookingId, actorId)
    : ref.adoptionId
      ? syncAdoption(tx, ref.adoptionId)
      : Promise.resolve();

const referenceInclude = {
  booking: { select: { bookingNo: true } },
  adoption: { select: { application: { select: { applicationNo: true } } } },
} as const;

const referenceOf = (p: {
  transactionId: string;
  booking?: { bookingNo: string } | null;
  adoption?: { application: { applicationNo: string } } | null;
}) => p.booking?.bookingNo ?? p.adoption?.application.applicationNo ?? p.transactionId;

const sendReceipt = async (paymentId: number) => {
  const full = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: { select: { id: true, firstName: true, email: true } }, ...referenceInclude },
  });
  if (!full) return;
  const reference = referenceOf(full);
  emailService.queue({ email: full.user.email, name: full.user.firstName }, 'PAYMENT_RECEIPT', {
    name: full.user.firstName,
    reference,
    transactionId: full.transactionId,
    amount: formatMoney(toNumber(full.amount), full.currency),
    method: full.method.replace('_', ' '),
    paidAt: (full.paidAt ?? new Date()).toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
  });
  notificationService.notify(full.userId, {
    type: 'payment.success',
    title: 'Payment received',
    message: `${formatMoney(toNumber(full.amount), full.currency)} for ${reference}`,
    data: { transactionId: full.transactionId, reference },
  });
};

/* ───────────────────────── list helpers ───────────────────────── */

const allPayments = createCrudService<Payment>({
  delegate: () => prisma.payment,
  entityName: 'Payment',
  queryConfig: adminPaymentQueryConfig,
  include: paymentInclude,
});

const myPayments = createCrudService({
  delegate: () => prisma.payment,
  entityName: 'Payment',
  queryConfig: myPaymentQueryConfig,
  include: {
    booking: { select: { id: true, bookingNo: true } },
    adoption: { select: { id: true, application: { select: { applicationNo: true } } } },
  },
  omit: myPaymentOmit,
});

/* ───────────────────────── service ───────────────────────── */

export const PaymentService = {
  /** Step 1 — create a pending payment and an SSLCommerz checkout session */
  async init(user: AuthUser, { currency, ...ref }: InitPaymentInput) {
    const payable = await loadPayable(ref, user.id);
    const due = await dueAmount(payable);
    if (due <= 0) throw AppError.conflict('Nothing to pay — this is already paid');

    const rate = currency === 'USD' ? await settingsService.getNumber('usd_exchange_rate') : 1;
    if (!(rate > 0)) throw AppError.serviceUnavailable('USD payments are not configured');
    const amount = round2(due / rate);

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        ...payable.link,
        amount,
        currency,
        exchangeRate: rate,
        baseAmount: due,
        method: 'sslcommerz',
        gateway: 'sslcommerz',
        transactionId: generateReferenceNo('TXN'),
      },
    });

    try {
      const session = await sslcommerz.initSession({
        tranId: payment.transactionId,
        amount,
        currency,
        productName: payable.productName,
        productCategory: payable.productCategory,
        customer: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: payable.customer.phone,
          address: payable.customer.address,
        },
        valueA: payable.reference,
      });
      await prisma.payment.update({
        where: { id: payment.id },
        data: { gatewayResponse: { sessionKey: session.sessionKey ?? null } },
      });
      return {
        paymentId: payment.id,
        transactionId: payment.transactionId,
        reference: payable.reference,
        amount,
        currency,
        gatewayUrl: session.gatewayUrl,
      };
    } catch (err) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', note: 'Could not create gateway session' },
      });
      throw err;
    }
  },

  /**
   * Step 2 — called from the success callback and the IPN.
   * Verifies the payment with SSLCommerz (status, transaction id, amount, currency) and is idempotent.
   */
  async confirmGatewayPayment({ tran_id, val_id }: GatewayCallback) {
    const payment = await prisma.payment.findUnique({ where: { transactionId: tran_id } });
    if (!payment || payment.type !== 'payment') throw AppError.notFound('Payment');
    if (payment.status === 'success') return { payment, alreadyProcessed: true };
    if (!val_id) throw AppError.badRequest('Missing validation id');

    const v = await sslcommerz.validate(val_id);
    const paidCurrency = v.currency_type ?? v.currency;
    const paidAmount = Number(v.currency_amount ?? v.amount);
    const problems = [
      !GATEWAY_VALID_STATUSES.includes(v.status) && `status ${v.status}`,
      v.tran_id !== tran_id && 'transaction id mismatch',
      paidCurrency !== payment.currency && 'currency mismatch',
      Math.abs(paidAmount - toNumber(payment.amount)) > 0.01 && 'amount mismatch',
    ].filter(Boolean);

    if (problems.length) {
      logger.warn({ tran_id, problems }, 'SSLCommerz validation failed');
      await prisma.payment.updateMany({
        where: { id: payment.id, status: { not: 'success' } },
        data: {
          status: 'failed',
          gatewayResponse: v as object,
          note: `Validation failed: ${problems.join(', ')}`,
        },
      });
      throw AppError.badRequest('Payment could not be verified');
    }

    const processed = await prisma.$transaction(async (tx) => {
      // only one of (success redirect, IPN) wins
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: 'success' } },
        data: {
          status: 'success',
          valId: v.val_id,
          bankTranId: v.bank_tran_id ?? null,
          paidAt: new Date(),
          gatewayResponse: v as object,
        },
      });
      if (count === 0) return false;
      await syncPayable(tx, payment, null);
      return true;
    });

    if (processed) await sendReceipt(payment.id);
    const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    return { payment: updated, alreadyProcessed: !processed };
  },

  /** fail / cancel callbacks — only touches payments that are still pending */
  async markUnsuccessful(
    { tran_id, ...rest }: GatewayCallback,
    status: Extract<TransactionStatus, 'failed' | 'cancelled'>,
  ) {
    await prisma.payment.updateMany({
      where: { transactionId: tran_id, status: 'pending' },
      data: { status, gatewayResponse: rest as object },
    });
  },

  /** Counter payment (cash / card machine / bKash to the shop number) */
  async recordManual(
    actor: AuthUser,
    { amount: requested, method, note, ...ref }: CashPaymentInput,
  ) {
    const payable = await loadPayable(ref);
    const due = await dueAmount(payable);
    if (due <= 0) throw AppError.conflict('Nothing to pay — this is already paid');
    const amount = requested ?? due;
    if (amount > due) throw AppError.badRequest(`Amount exceeds the due amount (${due})`);

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          userId: payable.userId,
          ...payable.link,
          amount,
          currency: 'BDT',
          exchangeRate: 1,
          baseAmount: amount,
          method,
          transactionId: generateReferenceNo('CASH'),
          status: 'success',
          paidAt: new Date(),
          note: note ?? `Recorded by ${actor.firstName} ${actor.lastName}`,
        },
      });
      await syncPayable(tx, created, actor.id);
      return created;
    });
    await sendReceipt(payment.id);
    return PaymentService.getById(payment.id);
  },

  /** Full or partial refund of a successful payment */
  async refund(actor: AuthUser, paymentId: number, input: RefundInput) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: { where: { status: { in: ['success', 'pending'] } } }, user: true },
    });
    if (!payment) throw AppError.notFound('Payment');
    if (payment.type !== 'payment' || payment.status !== 'success') {
      throw AppError.badRequest('Only successful payments can be refunded');
    }

    const refundable = round2(
      toNumber(payment.amount) - sumBy(payment.refunds, (r) => toNumber(r.amount)),
    );
    if (refundable <= 0) throw AppError.conflict('This payment is already fully refunded');
    const amount = input.amount ?? refundable;
    if (amount > refundable)
      throw AppError.badRequest(`Maximum refundable amount is ${refundable}`);

    const transactionId = generateReferenceNo('RF');
    let status: TransactionStatus = 'success';
    let gatewayResponse: object | undefined;

    if (payment.method === 'sslcommerz') {
      if (!payment.bankTranId)
        throw AppError.badRequest('Missing bank transaction id for this payment');
      const res = await sslcommerz.refund({
        bankTranId: payment.bankTranId,
        amount,
        remarks: input.reason,
        refId: transactionId,
      });
      gatewayResponse = res;
      status =
        res.status === 'success' ? 'success' : res.status === 'processing' ? 'pending' : 'failed';
    }

    const refund = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          userId: payment.userId,
          bookingId: payment.bookingId,
          adoptionId: payment.adoptionId,
          refundOfId: payment.id,
          type: 'refund',
          amount,
          currency: payment.currency,
          exchangeRate: payment.exchangeRate,
          baseAmount: round2(amount * toNumber(payment.exchangeRate)),
          method: payment.method,
          gateway: payment.gateway,
          transactionId,
          status,
          paidAt: status === 'success' ? new Date() : null,
          gatewayResponse,
          note: `${input.reason} — by ${actor.firstName} ${actor.lastName}`,
        },
      });
      if (status === 'success') {
        if (amount === refundable) {
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'refunded' } });
        }
        await syncPayable(tx, payment, actor.id);
      }
      return created;
    });

    if (status === 'failed') {
      const reason = (gatewayResponse as { errorReason?: string } | undefined)?.errorReason;
      throw new AppError(502, `Refund was rejected by the gateway${reason ? `: ${reason}` : ''}`);
    }

    emailService.queue(
      { email: payment.user.email, name: payment.user.firstName },
      'REFUND_PROCESSED',
      {
        name: payment.user.firstName,
        reference: payment.transactionId,
        amount: formatMoney(amount, payment.currency),
        status: status === 'success' ? 'completed' : 'being processed',
      },
    );
    return PaymentService.getById(refund.id);
  },

  getMine: (userId: number, query: PaymentListQuery) => myPayments.getAll(query, { userId }),

  getMineById: (userId: number, id: number) => myPayments.getOne({ id, userId }),

  getAll: (query: PaymentListQuery) => allPayments.getAll(query),

  getById: (id: number) => allPayments.getById(id),

  /** Used by the redirect callbacks to build the frontend URL */
  async findReference(transactionId: string) {
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      select: { transactionId: true, ...referenceInclude },
    });
    if (!payment) return null;
    return {
      reference: referenceOf(payment),
      bookingNo: payment.booking?.bookingNo,
      applicationNo: payment.adoption?.application.applicationNo,
    };
  },
};
