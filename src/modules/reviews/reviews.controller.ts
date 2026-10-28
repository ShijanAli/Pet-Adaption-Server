import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendResponse } from '@/shared/utils/sendResponse';
import { ReviewService } from './reviews.service';
import type { ReviewListQuery } from './reviews.validation';

const query = (req: Request) => req.query as unknown as ReviewListQuery;
const id = (req: Request) => Number(req.params.id);

export const ReviewController = {
  /* public */
  async getForService(req: Request, res: Response) {
    const { data, meta } = await ReviewService.getForService(
      String(req.params.idOrSlug),
      query(req),
    );
    sendResponse(res, { message: 'Reviews retrieved successfully', data, meta });
  },

  async getSummary(req: Request, res: Response) {
    const data = await ReviewService.getSummary(String(req.params.idOrSlug));
    sendResponse(res, { message: 'Rating summary retrieved successfully', data });
  },

  /* customer */
  async create(req: Request, res: Response) {
    const data = await ReviewService.create(req.user!.id, req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Thanks! Your review will be visible after moderation',
      data,
    });
  },

  async getMine(req: Request, res: Response) {
    const { data, meta } = await ReviewService.getMine(req.user!.id, query(req));
    sendResponse(res, { message: 'Reviews retrieved successfully', data, meta });
  },

  async updateMine(req: Request, res: Response) {
    const data = await ReviewService.updateMine(req.user!.id, id(req), req.body);
    sendResponse(res, { message: 'Review updated and sent for moderation', data });
  },

  async removeMine(req: Request, res: Response) {
    await ReviewService.removeMine(req.user!.id, id(req));
    sendResponse(res, { message: 'Review deleted successfully' });
  },

  /* admin */
  async getAll(req: Request, res: Response) {
    const { data, meta } = await ReviewService.getAll(query(req));
    sendResponse(res, { message: 'Reviews retrieved successfully', data, meta });
  },

  async getById(req: Request, res: Response) {
    const data = await ReviewService.getById(id(req));
    sendResponse(res, { message: 'Review retrieved successfully', data });
  },

  async moderate(req: Request, res: Response) {
    const data = await ReviewService.moderate(id(req), req.body.status);
    sendResponse(res, { message: `Review ${req.body.status}`, data });
  },

  async reply(req: Request, res: Response) {
    const data = await ReviewService.reply(id(req), req.body.reply);
    sendResponse(res, { message: req.body.reply ? 'Reply saved' : 'Reply removed', data });
  },

  async remove(req: Request, res: Response) {
    await ReviewService.removeById(id(req));
    sendResponse(res, { message: 'Review deleted successfully' });
  },
};
