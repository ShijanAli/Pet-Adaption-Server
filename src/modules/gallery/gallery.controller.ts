import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { createCrudController } from '@/shared/crud/crud.factory';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { hasPermission } from '@/shared/utils/access';
import { sendResponse } from '@/shared/utils/sendResponse';
import { AlbumService, GalleryItemService } from './gallery.service';
import type { AlbumListQuery, ItemListQuery } from './gallery.validation';

const canManage = (req: Request) => hasPermission(req.user, PERMISSIONS.GALLERY.UPDATE);

export const AlbumController = {
  ...createCrudController(
    { create: AlbumService.create, update: AlbumService.update, remove: AlbumService.remove },
    { singular: 'Album', plural: 'Albums' },
  ),

  async getAll(req: Request, res: Response) {
    const { data, meta } = await AlbumService.getAll(
      req.query as unknown as AlbumListQuery,
      await canManage(req),
    );
    sendResponse(res, { message: 'Albums retrieved successfully', data, meta });
  },

  async getOne(req: Request, res: Response) {
    const data = await AlbumService.getByIdOrSlug(
      String(req.params.idOrSlug),
      await canManage(req),
    );
    sendResponse(res, { message: 'Album retrieved successfully', data });
  },
};

export const GalleryItemController = {
  ...createCrudController(
    { update: GalleryItemService.update, remove: GalleryItemService.remove },
    { singular: 'Gallery item', plural: 'Gallery items' },
  ),

  async getAll(req: Request, res: Response) {
    const { data, meta } = await GalleryItemService.getAll(
      req.query as unknown as ItemListQuery,
      await canManage(req),
    );
    sendResponse(res, { message: 'Gallery items retrieved successfully', data, meta });
  },

  async getById(req: Request, res: Response) {
    const data = await GalleryItemService.getById(Number(req.params.id), await canManage(req));
    sendResponse(res, { message: 'Gallery item retrieved successfully', data });
  },

  async create(req: Request, res: Response) {
    const data = await GalleryItemService.create(req.user!.id, req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Gallery item created successfully',
      data,
    });
  },

  async bulkCreate(req: Request, res: Response) {
    const data = await GalleryItemService.bulkCreate(req.user!.id, req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: `${data.created} items added`,
      data,
    });
  },

  async reorder(req: Request, res: Response) {
    const data = await GalleryItemService.reorder(req.body.items);
    sendResponse(res, { message: 'Order saved', data });
  },
};
