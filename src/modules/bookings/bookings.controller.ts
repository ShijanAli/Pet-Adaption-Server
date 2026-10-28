import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendResponse } from '@/shared/utils/sendResponse';
import { BookingService } from './bookings.service';
import type { BookingListQuery } from './bookings.validation';

const query = (req: Request) => req.query as unknown as BookingListQuery;
const idOrNo = (req: Request) => String(req.params.idOrNo);
const id = (req: Request) => Number(req.params.id);

export const BookingController = {
  /* customer */
  async create(req: Request, res: Response) {
    const data = await BookingService.create(req.user!, req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Booking created. Complete the payment to confirm it',
      data,
    });
  },

  async getMine(req: Request, res: Response) {
    const { data, meta } = await BookingService.getMine(req.user!.id, query(req));
    sendResponse(res, { message: 'Bookings retrieved successfully', data, meta });
  },

  async getMineOne(req: Request, res: Response) {
    const data = await BookingService.getMineByIdOrNo(req.user!.id, idOrNo(req));
    sendResponse(res, { message: 'Booking retrieved successfully', data });
  },

  async cancelMine(req: Request, res: Response) {
    const data = await BookingService.cancelMine(req.user!.id, idOrNo(req), req.body.reason);
    const paid = data.paymentStatus === 'paid' || data.paymentStatus === 'partial';
    sendResponse(res, {
      message: paid
        ? 'Booking cancelled. Your refund will be processed by our team'
        : 'Booking cancelled successfully',
      data,
    });
  },

  /* staff */
  async getAssigned(req: Request, res: Response) {
    const { data, meta } = await BookingService.getAssigned(req.user!.id, query(req));
    sendResponse(res, { message: 'Assigned bookings retrieved successfully', data, meta });
  },

  /* admin */
  async getAll(req: Request, res: Response) {
    const { data, meta } = await BookingService.getAll(query(req));
    sendResponse(res, { message: 'Bookings retrieved successfully', data, meta });
  },

  async getById(req: Request, res: Response) {
    const data = await BookingService.getById(id(req));
    sendResponse(res, { message: 'Booking retrieved successfully', data });
  },

  async getLogs(req: Request, res: Response) {
    const data = await BookingService.getLogs(id(req));
    sendResponse(res, { message: 'Booking history retrieved successfully', data });
  },

  async updateStatus(req: Request, res: Response) {
    const data = await BookingService.updateStatus(
      req.user!,
      id(req),
      req.body.status,
      req.body.note,
    );
    sendResponse(res, { message: `Booking marked as ${req.body.status.replace('_', ' ')}`, data });
  },

  async assignStaff(req: Request, res: Response) {
    const data = await BookingService.assignStaff(id(req), req.body.staffId);
    sendResponse(res, { message: 'Staff assigned successfully', data });
  },
};
