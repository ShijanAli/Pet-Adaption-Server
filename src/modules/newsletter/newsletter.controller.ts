import type { Request, Response } from 'express';
import { sendResponse } from '@/shared/utils/sendResponse';
import { NewsletterService } from './newsletter.service';
import type { SubscriberListQuery } from './newsletter.validation';

export const NewsletterController = {
  async subscribe(req: Request, res: Response) {
    await NewsletterService.subscribe(req.body.email);
    sendResponse(res, { message: 'Subscribed successfully' });
  },

  async unsubscribe(req: Request, res: Response) {
    await NewsletterService.unsubscribe(req.body.email, req.body.token);
    sendResponse(res, { message: 'You have been unsubscribed' });
  },

  async getAll(req: Request, res: Response) {
    const { data, meta } = await NewsletterService.getAll(
      req.query as unknown as SubscriberListQuery,
    );
    sendResponse(res, { message: 'Subscribers retrieved successfully', data, meta });
  },

  /** File download — the one endpoint that does not return the JSON envelope */
  async exportCsv(req: Request, res: Response) {
    const status = (req.query as { status: 'subscribed' | 'unsubscribed' }).status;
    const csv = await NewsletterService.exportCsv(status);
    res
      .status(200)
      .type('text/csv')
      .attachment(`newsletter-${status}-${new Date().toISOString().slice(0, 10)}.csv`)
      .send(csv);
  },
};
