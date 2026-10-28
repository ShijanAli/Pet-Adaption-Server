import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { createCrudController } from '@/shared/crud/crud.factory';
import { sendResponse } from '@/shared/utils/sendResponse';
import { ContactService } from './contact.service';

export const ContactController = {
  ...createCrudController(
    {
      getAll: ContactService.getAll,
      getById: ContactService.getById,
      remove: ContactService.remove,
    },
    { singular: 'Message', plural: 'Messages' },
  ),

  async create(req: Request, res: Response) {
    const data = await ContactService.create(req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Thanks for reaching out! We will reply soon',
      data,
    });
  },

  async updateStatus(req: Request, res: Response) {
    const data = await ContactService.updateStatus(Number(req.params.id), req.body.status);
    sendResponse(res, { message: 'Message status updated', data });
  },
};
