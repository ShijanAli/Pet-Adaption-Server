import type { Request, Response } from 'express';
import { createCrudController } from '@/shared/crud/crud.factory';
import { sendResponse } from '@/shared/utils/sendResponse';
import { RoleService } from './roles.service';

export const RoleController = {
  // getAll, getById, create, update, remove → generic handlers
  ...createCrudController(RoleService, { singular: 'Role', plural: 'Roles' }),

  async assignPermissions(req: Request, res: Response) {
    const data = await RoleService.assignPermissions(Number(req.params.id), req.body.permissionIds);
    sendResponse(res, { message: 'Role permissions updated successfully', data });
  },
};
