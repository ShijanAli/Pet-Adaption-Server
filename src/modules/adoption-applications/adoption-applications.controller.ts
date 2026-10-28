import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendResponse } from '@/shared/utils/sendResponse';
import { ApplicationService } from './adoption-applications.service';
import type { ApplicationListQuery } from './adoption-applications.validation';

const query = (req: Request) => req.query as unknown as ApplicationListQuery;
const idOrNo = (req: Request) => String(req.params.idOrNo);

export const ApplicationController = {
  async apply(req: Request, res: Response) {
    const data = await ApplicationService.apply(req.user!, req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Application submitted. We will get back to you soon',
      data,
    });
  },

  async getMine(req: Request, res: Response) {
    const { data, meta } = await ApplicationService.getMine(req.user!.id, query(req));
    sendResponse(res, { message: 'Applications retrieved successfully', data, meta });
  },

  async getMineOne(req: Request, res: Response) {
    const data = await ApplicationService.getMineByIdOrNo(req.user!.id, idOrNo(req));
    sendResponse(res, { message: 'Application retrieved successfully', data });
  },

  async cancelMine(req: Request, res: Response) {
    const data = await ApplicationService.cancelMine(req.user!.id, idOrNo(req), req.body.reason);
    sendResponse(res, { message: 'Application cancelled', data });
  },

  async getAll(req: Request, res: Response) {
    const { data, meta } = await ApplicationService.getAll(query(req));
    sendResponse(res, { message: 'Applications retrieved successfully', data, meta });
  },

  async getById(req: Request, res: Response) {
    const data = await ApplicationService.getById(Number(req.params.id));
    sendResponse(res, { message: 'Application retrieved successfully', data });
  },

  async review(req: Request, res: Response) {
    const data = await ApplicationService.review(req.user!, Number(req.params.id), req.body);
    sendResponse(res, { message: `Application ${req.body.status.replace('_', ' ')}`, data });
  },
};
