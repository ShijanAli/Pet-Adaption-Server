import type { Request, Response } from 'express';
import { createCrudController } from '@/shared/crud/crud.factory';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { hasPermission } from '@/shared/utils/access';
import { sendResponse } from '@/shared/utils/sendResponse';
import { TestimonialService } from './testimonials.service';
import type { TestimonialListQuery } from './testimonials.validation';

const canManage = (req: Request) => hasPermission(req.user, PERMISSIONS.TESTIMONIAL.UPDATE);

export const TestimonialController = {
  ...createCrudController(
    {
      create: TestimonialService.create,
      update: TestimonialService.update,
      remove: TestimonialService.remove,
    },
    { singular: 'Testimonial', plural: 'Testimonials' },
  ),

  async getAll(req: Request, res: Response) {
    const { data, meta } = await TestimonialService.getAll(
      req.query as unknown as TestimonialListQuery,
      await canManage(req),
    );
    sendResponse(res, { message: 'Testimonials retrieved successfully', data, meta });
  },

  async getById(req: Request, res: Response) {
    const data = await TestimonialService.getVisible(Number(req.params.id), await canManage(req));
    sendResponse(res, { message: 'Testimonial retrieved successfully', data });
  },
};
