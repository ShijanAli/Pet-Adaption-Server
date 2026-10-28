import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { hasPermission } from '@/shared/utils/access';
import { sendResponse } from '@/shared/utils/sendResponse';
import { AdoptionPetService, type Viewer } from './adoption-pets.service';
import type { ListAdoptionPetsQuery } from './adoption-pets.validation';

const viewer = async (req: Request): Promise<Viewer> => ({
  canManage: await hasPermission(req.user, PERMISSIONS.ADOPTION_PET.UPDATE),
  userId: req.user?.id,
});
const id = (req: Request) => Number(req.params.id);

export const AdoptionPetController = {
  async getAll(req: Request, res: Response) {
    const { data, meta } = await AdoptionPetService.getAll(
      req.query as unknown as ListAdoptionPetsQuery,
      await viewer(req),
    );
    sendResponse(res, { message: 'Adoption pets retrieved successfully', data, meta });
  },

  async getOne(req: Request, res: Response) {
    const data = await AdoptionPetService.getByIdOrSlug(
      String(req.params.idOrSlug),
      await viewer(req),
    );
    sendResponse(res, { message: 'Adoption pet retrieved successfully', data });
  },

  async create(req: Request, res: Response) {
    const data = await AdoptionPetService.create(req.user!.id, req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Adoption pet listed successfully',
      data,
    });
  },

  async update(req: Request, res: Response) {
    const data = await AdoptionPetService.update(id(req), req.body);
    sendResponse(res, { message: 'Adoption pet updated successfully', data });
  },

  async updateStatus(req: Request, res: Response) {
    const data = await AdoptionPetService.updateStatus(id(req), req.body.status);
    sendResponse(res, { message: 'Adoption pet status updated successfully', data });
  },

  async remove(req: Request, res: Response) {
    await AdoptionPetService.remove(id(req));
    sendResponse(res, { message: 'Adoption pet deleted successfully' });
  },

  async addImages(req: Request, res: Response) {
    const data = await AdoptionPetService.addImages(id(req), req.body.images);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Images added successfully',
      data,
    });
  },

  async setPrimaryImage(req: Request, res: Response) {
    const data = await AdoptionPetService.setPrimaryImage(id(req), Number(req.params.imageId));
    sendResponse(res, { message: 'Primary image updated successfully', data });
  },

  async removeImage(req: Request, res: Response) {
    const data = await AdoptionPetService.removeImage(id(req), Number(req.params.imageId));
    sendResponse(res, { message: 'Image removed successfully', data });
  },
};
