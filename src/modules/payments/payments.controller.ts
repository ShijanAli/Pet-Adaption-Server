import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendResponse } from '@/shared/utils/sendResponse';
import { PaymentService } from './payments.service';
import type { PaymentListQuery } from './payments.validation';

const query = (req: Request) => req.query as unknown as PaymentListQuery;
const id = (req: Request) => Number(req.params.id);

export const PaymentController = {
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
      message: 'Refund recorded successfully',
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
