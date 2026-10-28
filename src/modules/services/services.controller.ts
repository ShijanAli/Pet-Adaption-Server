import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { hasPermission } from '@/shared/utils/access';
import { sendResponse } from '@/shared/utils/sendResponse';
import { ServiceService } from './services.service';
import type { ListServicesQuery } from './services.validation';

const canManage = (req: Request) => hasPermission(req.user, PERMISSIONS.SERVICE.UPDATE);
const id = (req: Request) => Number(req.params.id);

export const ServiceController = {
  async getAll(req: Request, res: Response) {
    const { data, meta } = await ServiceService.getAll(
      req.query as unknown as ListServicesQuery,
      await canManage(req),
    );
    sendResponse(res, { message: 'Services retrieved successfully', data, meta });
  },

  async getOne(req: Request, res: Response) {
    const data = await ServiceService.getByIdOrSlug(
      String(req.params.idOrSlug),
      await canManage(req),
    );
    sendResponse(res, { message: 'Service retrieved successfully', data });
  },

  async create(req: Request, res: Response) {
    const data = await ServiceService.create(req.user!.id, req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Service created successfully',
      data,
    });
  },

  async update(req: Request, res: Response) {
    const data = await ServiceService.update(req.user!.id, id(req), req.body);
    sendResponse(res, { message: 'Service updated successfully', data });
  },

  async updateStatus(req: Request, res: Response) {
    const data = await ServiceService.updateStatus(req.user!.id, id(req), req.body.status);
    sendResponse(res, { message: 'Service status updated successfully', data });
  },

  async setPetTypes(req: Request, res: Response) {
    const data = await ServiceService.setPetTypes(req.user!.id, id(req), req.body.petTypeIds);
    sendResponse(res, { message: 'Service pet types updated successfully', data });
  },

  async setStaff(req: Request, res: Response) {
    const data = await ServiceService.setStaff(req.user!.id, id(req), req.body.staffIds);
    sendResponse(res, { message: 'Service staff updated successfully', data });
  },

  async remove(req: Request, res: Response) {
    await ServiceService.remove(req.user!.id, id(req));
    sendResponse(res, { message: 'Service deleted successfully' });
  },
};
