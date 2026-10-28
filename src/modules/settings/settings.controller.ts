import type { Request, Response } from 'express';
import { sendResponse } from '@/shared/utils/sendResponse';
import { SettingService } from './settings.service';

export const SettingController = {
  async getPublic(_req: Request, res: Response) {
    const data = await SettingService.getPublic();
    sendResponse(res, { message: 'Settings retrieved successfully', data });
  },

  async getAll(req: Request, res: Response) {
    const data = await SettingService.getAll((req.query as { group?: string }).group);
    sendResponse(res, { message: 'Settings retrieved successfully', data });
  },

  async update(req: Request, res: Response) {
    const data = await SettingService.update(req.body.values);
    sendResponse(res, { message: 'Settings saved successfully', data });
  },
};
