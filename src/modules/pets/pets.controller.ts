import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendResponse } from '@/shared/utils/sendResponse';
import { AdminPetService, MyPetService } from './pets.service';
import type { PetListQuery } from './pets.validation';

const id = (req: Request) => Number(req.params.id);
const query = (req: Request) => req.query as unknown as PetListQuery;

export const MyPetController = {
  async getAll(req: Request, res: Response) {
    const { data, meta } = await MyPetService.getAll(req.user!.id, query(req));
    sendResponse(res, { message: 'Pets retrieved successfully', data, meta });
  },

  async getById(req: Request, res: Response) {
    const data = await MyPetService.getById(req.user!.id, id(req));
    sendResponse(res, { message: 'Pet retrieved successfully', data });
  },

  async create(req: Request, res: Response) {
    const data = await MyPetService.create(req.user!.id, req.body);
    sendResponse(res, { statusCode: StatusCodes.CREATED, message: 'Pet added successfully', data });
  },

  async update(req: Request, res: Response) {
    const data = await MyPetService.update(req.user!.id, id(req), req.body);
    sendResponse(res, { message: 'Pet updated successfully', data });
  },

  async remove(req: Request, res: Response) {
    await MyPetService.remove(req.user!.id, id(req));
    sendResponse(res, { message: 'Pet deleted successfully' });
  },
};

export const AdminPetController = {
  async getAll(req: Request, res: Response) {
    const { data, meta } = await AdminPetService.getAll(query(req));
    sendResponse(res, { message: 'Pets retrieved successfully', data, meta });
  },

  async getById(req: Request, res: Response) {
    const data = await AdminPetService.getById(id(req));
    sendResponse(res, { message: 'Pet retrieved successfully', data });
  },
};
