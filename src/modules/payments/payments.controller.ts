import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { sendResponse } from '@/shared/utils/sendResponse';
import { PaymentService } from './payments.service';
import type { GatewayCallback, PaymentListQuery } from './payments.validation';

const query = (req: Request) => req.query as unknown as PaymentListQuery;
const id = (req: Request) => Number(req.params.id);

/** Browser redirects back to the frontend after the hosted payment page */
const redirectToClient = async (
  res: Response,
  page: 'success' | 'failed' | 'cancelled',
  tranId: string,
) => {
  const ref = await PaymentService.findReference(tranId).catch(() => null);
  const params = new URLSearchParams({ tranId });
  if (ref?.reference) params.set('reference', ref.reference);
  if (ref?.bookingNo) params.set('bookingNo', ref.bookingNo);
  if (ref?.applicationNo) params.set('applicationNo', ref.applicationNo);
  // 303 → browser follows with GET even though SSLCommerz POSTed to us
  res.redirect(StatusCodes.SEE_OTHER, `${env.CLIENT_URL}/payment/${page}?${params}`);
};

export const PaymentController = {
  async init(req: Request, res: Response) {
    const data = await PaymentService.init(req.user!, req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Payment session created. Redirect the user to gatewayUrl',
      data,
    });
  },

  /* ───── SSLCommerz callbacks (form POSTs) ───── */

  async gatewaySuccess(req: Request, res: Response) {
    const body = req.body as GatewayCallback;
    try {
      await PaymentService.confirmGatewayPayment(body);
      await redirectToClient(res, 'success', body.tran_id);
    } catch (err) {
      logger.warn({ err, tranId: body.tran_id }, 'Payment success callback could not be verified');
      await redirectToClient(res, 'failed', body.tran_id);
    }
  },

  async gatewayFail(req: Request, res: Response) {
    await PaymentService.markUnsuccessful(req.body, 'failed');
    await redirectToClient(res, 'failed', req.body.tran_id);
  },

  async gatewayCancel(req: Request, res: Response) {
    await PaymentService.markUnsuccessful(req.body, 'cancelled');
    await redirectToClient(res, 'cancelled', req.body.tran_id);
  },

  /** Server-to-server notification — the source of truth if the browser never returns */
  async gatewayIpn(req: Request, res: Response) {
    const body = req.body as GatewayCallback;
    const status = (body.status ?? '').toUpperCase();
    if (status === 'VALID' || status === 'VALIDATED') {
      await PaymentService.confirmGatewayPayment(body);
    } else if (status === 'CANCELLED') {
      await PaymentService.markUnsuccessful(body, 'cancelled');
    } else {
      await PaymentService.markUnsuccessful(body, 'failed');
    }
    sendResponse(res, { message: 'IPN received' });
  },

  /* ───── staff / admin ───── */

  async recordManual(req: Request, res: Response) {
    const data = await PaymentService.recordManual(req.user!, req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Payment recorded successfully',
      data,
    });
  },

  async refund(req: Request, res: Response) {
    const data = await PaymentService.refund(req.user!, id(req), req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message:
        data.status === 'success' ? 'Refund completed' : 'Refund is being processed by the gateway',
      data,
    });
  },

  async getAll(req: Request, res: Response) {
    const { data, meta } = await PaymentService.getAll(query(req));
    sendResponse(res, { message: 'Payments retrieved successfully', data, meta });
  },

  async getById(req: Request, res: Response) {
    const data = await PaymentService.getById(id(req));
    sendResponse(res, { message: 'Payment retrieved successfully', data });
  },

  /* ───── customer ───── */

  async getMine(req: Request, res: Response) {
    const { data, meta } = await PaymentService.getMine(req.user!.id, query(req));
    sendResponse(res, { message: 'Payments retrieved successfully', data, meta });
  },

  async getMineById(req: Request, res: Response) {
    const data = await PaymentService.getMineById(req.user!.id, id(req));
    sendResponse(res, { message: 'Payment retrieved successfully', data });
  },
};
