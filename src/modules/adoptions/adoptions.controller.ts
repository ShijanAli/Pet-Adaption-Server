import type { Request, Response } from 'express';
import { sendResponse } from '@/shared/utils/sendResponse';
import { AdoptionService } from './adoptions.service';
import type { AdoptionListQuery } from './adoptions.validation';

const query = (req: Request) => req.query as unknown as AdoptionListQuery;
const id = (req: Request) => Number(req.params.id);

export const AdoptionController = {
  async getMine(req: Request, res: Response) {
    const { data, meta } = await AdoptionService.getMine(req.user!.id, query(req));
    sendResponse(res, { message: 'Adoptions retrieved successfully', data, meta });
  },

  async getMineById(req: Request, res: Response) {
    const data = await AdoptionService.getMineById(req.user!.id, id(req));
    sendResponse(res, { message: 'Adoption retrieved successfully', data });
  },

  async getAll(req: Request, res: Response) {
    const { data, meta } = await AdoptionService.getAll(query(req));
    sendResponse(res, { message: 'Adoptions retrieved successfully', data, meta });
  },

  async getById(req: Request, res: Response) {
    const data = await AdoptionService.getById(id(req));
    sendResponse(res, { message: 'Adoption retrieved successfully', data });
  },

  async update(req: Request, res: Response) {
    const data = await AdoptionService.update(id(req), req.body);
    sendResponse(res, { message: 'Adoption updated successfully', data });
  },

  async complete(req: Request, res: Response) {
    const data = await AdoptionService.complete(id(req), req.body);
    sendResponse(res, { message: 'Adoption completed 🎉', data });
  },

  async cancel(req: Request, res: Response) {
    const data = await AdoptionService.cancel(req.user!, id(req), req.body.reason);
    sendResponse(res, { message: 'Adoption cancelled. The pet is available again', data });
  },
};
