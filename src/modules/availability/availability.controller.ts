import type { Request, Response } from 'express';
import { sendResponse } from '@/shared/utils/sendResponse';
import { AvailabilityService } from './availability.service';
import type { AvailabilityQuery } from './availability.validation';

export const AvailabilityController = {
  async getSlots(req: Request, res: Response) {
    const { date, staffId } = req.query as unknown as AvailabilityQuery;
    const data = await AvailabilityService.getSlots({
      serviceId: Number(req.params.id),
      date,
      staffId,
    });
    sendResponse(res, { message: 'Available slots retrieved successfully', data });
  },
};
