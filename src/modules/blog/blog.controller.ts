import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { createCrudController } from '@/shared/crud/crud.factory';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { hasPermission } from '@/shared/utils/access';
import { sendResponse } from '@/shared/utils/sendResponse';
import { BlogCategoryService, BlogPostService } from './blog.service';
import type { CategoryListQuery, PostListQuery } from './blog.validation';

const canManage = (req: Request) => hasPermission(req.user, PERMISSIONS.BLOG.VIEW);

export const BlogCategoryController = {
  ...createCrudController(
    {
      create: BlogCategoryService.create,
      update: BlogCategoryService.update,
      remove: BlogCategoryService.remove,
    },
    { singular: 'Blog category', plural: 'Blog categories' },
  ),

  async getAll(req: Request, res: Response) {
    const { data, meta } = await BlogCategoryService.getAll(
      req.query as unknown as CategoryListQuery,
      await canManage(req),
    );
    sendResponse(res, { message: 'Blog categories retrieved successfully', data, meta });
  },

  async getOne(req: Request, res: Response) {
    const data = await BlogCategoryService.getByIdOrSlug(
      String(req.params.idOrSlug),
      await canManage(req),
    );
    sendResponse(res, { message: 'Blog category retrieved successfully', data });
  },
};

export const BlogPostController = {
  ...createCrudController(
    { update: BlogPostService.update, remove: BlogPostService.remove },
    { singular: 'Blog post', plural: 'Blog posts' },
  ),

  async getAll(req: Request, res: Response) {
    const { data, meta } = await BlogPostService.getAll(
      req.query as unknown as PostListQuery,
      await canManage(req),
    );
    sendResponse(res, { message: 'Blog posts retrieved successfully', data, meta });
  },

  async getOne(req: Request, res: Response) {
    const data = await BlogPostService.getByIdOrSlug(
      String(req.params.idOrSlug),
      await canManage(req),
    );
    sendResponse(res, { message: 'Blog post retrieved successfully', data });
  },

  async create(req: Request, res: Response) {
    const data = await BlogPostService.create(req.user!.id, req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Blog post created successfully',
      data,
    });
  },
};
