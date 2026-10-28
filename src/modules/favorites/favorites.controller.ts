import type { Request, Response } from 'express';
import { sendResponse } from '@/shared/utils/sendResponse';
import type { BaseListQuery } from '@/shared/utils/queryBuilder';
import { FavoriteService } from './favorites.service';

const petId = (req: Request) => Number(req.params.adoptionPetId);

export const FavoriteController = {
  async getMine(req: Request, res: Response) {
    const { data, meta } = await FavoriteService.getMine(
      req.user!.id,
      req.query as unknown as BaseListQuery,
    );
    sendResponse(res, { message: 'Favorites retrieved successfully', data, meta });
  },

  async add(req: Request, res: Response) {
    await FavoriteService.add(req.user!.id, petId(req));
    sendResponse(res, { message: 'Added to favorites' });
  },

  async remove(req: Request, res: Response) {
    await FavoriteService.remove(req.user!.id, petId(req));
    sendResponse(res, { message: 'Removed from favorites' });
  },
};
