import type { Request, Response } from 'express';
import { sendResponse } from '@/shared/utils/sendResponse';
import { StaffService } from './staff.service';
import type { ListStaffQuery } from './staff.validation';

export const StaffController = {
  async getAll(req: Request, res: Response) {
    const { data, meta } = await StaffService.getAll(req.query as unknown as ListStaffQuery);
    sendResponse(res, { message: 'Staff retrieved successfully', data, meta });
  },

  async getMySchedule(req: Request, res: Response) {
    const data = await StaffService.getSchedules(req.user!.id);
    sendResponse(res, { message: 'Schedule retrieved successfully', data });
  },

  async getSchedules(req: Request, res: Response) {
    const data = await StaffService.getSchedules(Number(req.params.id));
    sendResponse(res, { message: 'Schedule retrieved successfully', data });
  },

  async setSchedules(req: Request, res: Response) {
    const data = await StaffService.setSchedules(Number(req.params.id), req.body.schedules);
    sendResponse(res, { message: 'Schedule updated successfully', data });
  },
};
