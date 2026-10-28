import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { PaymentController } from './payments.controller';
import { PaymentValidation } from './payments.validation';

const r = createModuleRouter(
  '/payments',
  'Payments',
  'SSLCommerz online payments, counter payments and refunds',
);

r.post(
  '/init',
  {
    summary: 'Start an online payment (SSLCommerz)',
    description:
      'Pays the remaining due amount of a booking (`bookingId`) or an adoption fee (`adoptionId`) in BDT or USD ' +
      '(converted with the `usd_exchange_rate` setting). Redirect the browser to the returned `gatewayUrl`. ' +
      'Afterwards SSLCommerz sends the user to `CLIENT_URL/payment/success|failed|cancelled?tranId=…&reference=…` ' +
      '(+ `bookingNo` or `applicationNo`).',
    access: 'auth',
    body: PaymentValidation.init,
  },
  PaymentController.init,
);

const callback = (name: string, description: string) => ({
  summary: `SSLCommerz ${name} callback`,
  description: `${description} Called by SSLCommerz (form POST), not by the frontend.`,
  access: 'public' as const,
  body: PaymentValidation.gatewayCallback,
  successStatus: name === 'IPN' ? 200 : 303,
});

r.post(
  '/sslcommerz/success',
  callback('success', 'Verifies the payment, then redirects to the frontend.'),
  PaymentController.gatewaySuccess,
);
r.post(
  '/sslcommerz/fail',
  callback('fail', 'Marks the payment failed, then redirects.'),
  PaymentController.gatewayFail,
);
r.post(
  '/sslcommerz/cancel',
  callback('cancel', 'Marks the payment cancelled, then redirects.'),
  PaymentController.gatewayCancel,
);
r.post(
  '/sslcommerz/ipn',
  callback('IPN', 'Instant payment notification (server-to-server).'),
  PaymentController.gatewayIpn,
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
      'SSLCommerz payments are refunded through the gateway; counter payments are recorded directly.',
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
