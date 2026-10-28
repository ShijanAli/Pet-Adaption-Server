import type { Request, Response } from 'express';
import { sendResponse } from '@/shared/utils/sendResponse';
import { DashboardService } from './dashboard.service';
import type { RangeQuery, RevenueQuery, TopServicesQuery } from './dashboard.validation';

export const DashboardController = {
  async getStats(_req: Request, res: Response) {
    const data = await DashboardService.getStats();
    sendResponse(res, { message: 'Dashboard stats retrieved successfully', data });
  },

  async getRevenue(req: Request, res: Response) {
    const data = await DashboardService.getRevenue(req.query as unknown as RevenueQuery);
    sendResponse(res, { message: 'Revenue retrieved successfully', data });
  },

  async getTopServices(req: Request, res: Response) {
    const data = await DashboardService.getTopServices(req.query as unknown as TopServicesQuery);
    sendResponse(res, { message: 'Top services retrieved successfully', data });
  },

  async getBookingsByStatus(req: Request, res: Response) {
    const data = await DashboardService.getBookingsByStatus(req.query as unknown as RangeQuery);
    sendResponse(res, { message: 'Bookings by status retrieved successfully', data });
  },
};
