import type { Request, Response } from 'express';
import { createCrudController } from '@/shared/crud/crud.factory';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { hasPermission } from '@/shared/utils/access';
import { sendResponse } from '@/shared/utils/sendResponse';
import { ServiceCategoryService } from './service-categories.service';
import type { ListCategoriesQuery } from './service-categories.validation';

const canManage = (req: Request) => hasPermission(req.user, PERMISSIONS.SERVICE_CATEGORY.UPDATE);

const base = createCrudController(
  {
    create: ServiceCategoryService.create,
    update: ServiceCategoryService.update,
    remove: ServiceCategoryService.remove,
  },
  { singular: 'Service category', plural: 'Service categories' },
);

export const ServiceCategoryController = {
  ...base,

  async getAll(req: Request, res: Response) {
    const { data, meta } = await ServiceCategoryService.getAll(
      req.query as unknown as ListCategoriesQuery,
      await canManage(req),
    );
    sendResponse(res, { message: 'Service categories retrieved successfully', data, meta });
  },

  async getTree(req: Request, res: Response) {
    const data = await ServiceCategoryService.getTree(await canManage(req));
    sendResponse(res, { message: 'Category tree retrieved successfully', data });
  },

  async getOne(req: Request, res: Response) {
    const data = await ServiceCategoryService.getByIdOrSlug(
      String(req.params.idOrSlug),
      await canManage(req),
    );
    sendResponse(res, { message: 'Service category retrieved successfully', data });
  },
};
