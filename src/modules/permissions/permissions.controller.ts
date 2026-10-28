import type { Request, Response } from 'express';
import { sendResponse } from '@/shared/utils/sendResponse';
import { PermissionService } from './permissions.service';
import type { ListPermissionsQuery } from './permissions.validation';

export const PermissionController = {
  async getAll(req: Request, res: Response) {
    const data = await PermissionService.getAll(req.query as unknown as ListPermissionsQuery);
    sendResponse(res, { message: 'Permissions retrieved successfully', data });
  },
};
