import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendResponse } from '@/shared/utils/sendResponse';
import { UserService } from './users.service';
import type { ListUsersQuery } from './users.validation';

const id = (req: Request) => Number(req.params.id);

export const UserController = {
  async getAll(req: Request, res: Response) {
    const { data, meta } = await UserService.getAll(req.query as unknown as ListUsersQuery);
    sendResponse(res, { message: 'Users retrieved successfully', data, meta });
  },

  async getById(req: Request, res: Response) {
    const data = await UserService.getById(id(req));
    sendResponse(res, { message: 'User retrieved successfully', data });
  },

  async create(req: Request, res: Response) {
    const data = await UserService.create(req.user!, req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'User created successfully',
      data,
    });
  },

  async update(req: Request, res: Response) {
    const data = await UserService.update(id(req), req.body);
    sendResponse(res, { message: 'User updated successfully', data });
  },

  async updateStatus(req: Request, res: Response) {
    const data = await UserService.updateStatus(req.user!, id(req), req.body.status);
    sendResponse(res, { message: 'User status updated successfully', data });
  },

  async updateRole(req: Request, res: Response) {
    const data = await UserService.updateRole(req.user!, id(req), req.body.roleId);
    sendResponse(res, { message: 'User role updated successfully', data });
  },

  async remove(req: Request, res: Response) {
    await UserService.remove(req.user!, id(req));
    sendResponse(res, { message: 'User deleted successfully' });
  },
};
