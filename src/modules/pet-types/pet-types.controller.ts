import type { Request, Response } from 'express';
import { createCrudController } from '@/shared/crud/crud.factory';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { hasPermission } from '@/shared/utils/access';
import { sendResponse } from '@/shared/utils/sendResponse';
import { PetTypeService } from './pet-types.service';
import type { ListPetTypesQuery } from './pet-types.validation';

const canManage = (req: Request) => hasPermission(req.user, PERMISSIONS.PET_TYPE.UPDATE);

const base = createCrudController(
  { create: PetTypeService.create, update: PetTypeService.update, remove: PetTypeService.remove },
  { singular: 'Pet type', plural: 'Pet types' },
);

export const PetTypeController = {
  create: base.create,
  update: base.update,
  remove: base.remove,

  async getAll(req: Request, res: Response) {
    const { data, meta } = await PetTypeService.getAll(
      req.query as unknown as ListPetTypesQuery,
      await canManage(req),
    );
    sendResponse(res, { message: 'Pet types retrieved successfully', data, meta });
  },

  async getOne(req: Request, res: Response) {
    const data = await PetTypeService.getByIdOrSlug(
      String(req.params.idOrSlug),
      await canManage(req),
    );
    sendResponse(res, { message: 'Pet type retrieved successfully', data });
  },
};
