import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { PaymentController } from './payments.controller';
import { PaymentValidation } from './payments.validation';

const r = createModuleRouter(
  '/payments',
  'Payments',
  'Counter payments and refunds recorded by staff (online payment is switched off)',
);

r.post(
  '/cash',
  {
    summary: 'Record a counter payment (cash / card / mobile banking)',
    description:
      'For a booking (`bookingId`) or an adoption fee (`adoptionId`). Partial payments are allowed.',
    access: { permissions: [P.PAYMENT.CREATE] },
    body: PaymentValidation.cash,
  },
  PaymentController.recordManual,
);

r.post(
  '/:id/refund',
  {
    summary: 'Refund a payment (full or partial)',
    description:
      'Records the refund directly — hand the money back at the counter or by mobile banking.',
    access: { permissions: [P.PAYMENT.REFUND] },
    params: idParam,
    body: PaymentValidation.refund,
  },
  PaymentController.refund,
);

r.get(
  '/',
  {
    summary: 'List all payments & refunds',
    access: { permissions: [P.PAYMENT.VIEW] },
    query: PaymentValidation.adminListQuery,
  },
  PaymentController.getAll,
);

r.get(
  '/:id',
  { summary: 'Payment detail', access: { permissions: [P.PAYMENT.VIEW] }, params: idParam },
  PaymentController.getById,
);

const me = createModuleRouter('/me/payments', 'My Payments', "The logged-in customer's payments");

me.get(
  '/',
  { summary: 'List my payments', access: 'auth', query: PaymentValidation.myListQuery },
  PaymentController.getMine,
);
me.get(
  '/:id',
  { summary: 'Get my payment', access: 'auth', params: idParam },
  PaymentController.getMineById,
);

export const paymentRoutes = r;
export const myPaymentRoutes = me;
