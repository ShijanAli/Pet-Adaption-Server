import type { Request, Response } from 'express';
import { createCrudController } from '@/shared/crud/crud.factory';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { hasPermission } from '@/shared/utils/access';
import { sendResponse } from '@/shared/utils/sendResponse';
import { FaqService } from './faqs.service';
import type { FaqListQuery } from './faqs.validation';

const canManage = (req: Request) => hasPermission(req.user, PERMISSIONS.FAQ.UPDATE);

export const FaqController = {
  ...createCrudController(
    { create: FaqService.create, update: FaqService.update, remove: FaqService.remove },
    { singular: 'FAQ', plural: 'FAQs' },
  ),

  async getAll(req: Request, res: Response) {
    const { data, meta } = await FaqService.getAll(
      req.query as unknown as FaqListQuery,
      await canManage(req),
    );
    sendResponse(res, { message: 'FAQs retrieved successfully', data, meta });
  },

  async getById(req: Request, res: Response) {
    const data = await FaqService.getVisible(Number(req.params.id), await canManage(req));
    sendResponse(res, { message: 'FAQ retrieved successfully', data });
  },
};
