import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendResponse } from '@/shared/utils/sendResponse';
import type { BaseListQuery } from '@/shared/utils/queryBuilder';
import { PromotionService } from './promotions.service';
import type { ListPromotionsQuery } from './promotions.validation';

const id = (req: Request) => Number(req.params.id);

export const PromotionController = {
  async getAll(req: Request, res: Response) {
    const { data, meta } = await PromotionService.getAll(
      req.query as unknown as ListPromotionsQuery,
    );
    sendResponse(res, { message: 'Promotions retrieved successfully', data, meta });
  },

  async getActive(_req: Request, res: Response) {
    const data = await PromotionService.getActive();
    sendResponse(res, { message: 'Active promotions retrieved successfully', data });
  },

  async getById(req: Request, res: Response) {
    const data = await PromotionService.getById(id(req));
    sendResponse(res, { message: 'Promotion retrieved successfully', data });
  },

  async create(req: Request, res: Response) {
    const data = await PromotionService.create(req.user!.id, req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Promotion created successfully',
      data,
    });
  },

  async update(req: Request, res: Response) {
    const data = await PromotionService.update(id(req), req.body);
    sendResponse(res, { message: 'Promotion updated successfully', data });
  },

  async remove(req: Request, res: Response) {
    await PromotionService.remove(id(req));
    sendResponse(res, { message: 'Promotion deleted successfully' });
  },

  async getUsages(req: Request, res: Response) {
    const { data, meta } = await PromotionService.getUsages(
      id(req),
      req.query as unknown as BaseListQuery,
    );
    sendResponse(res, { message: 'Promotion usages retrieved successfully', data, meta });
  },

  async validate(req: Request, res: Response) {
    const data = await PromotionService.preview(req.user!.id, req.body.code, req.body.serviceId);
    sendResponse(res, { message: 'Promo code applied', data });
  },
};
