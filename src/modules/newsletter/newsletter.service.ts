import type { SubscriptionStatus } from '@generated/prisma/client';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { emailService } from '@/shared/services/email.service';
import { signValue, verifySignature } from '@/shared/utils/common';
import type { SubscriberListQuery } from './newsletter.validation';

const crud = createCrudService({
  delegate: () => prisma.newsletterSubscriber,
  entityName: 'Subscriber',
  queryConfig: { searchableFields: ['email'], filterableFields: ['status'] },
});

// separate purpose string so the signature can't be reused elsewhere
const sign = (email: string) => signValue(`newsletter:${email}`, env.JWT_ACCESS_SECRET);

export const unsubscribeUrl = (email: string) =>
  `${env.CLIENT_URL}/newsletter/unsubscribe?${new URLSearchParams({ email, token: sign(email) })}`;

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const NewsletterService = {
  /** Idempotent: subscribing twice is fine, unsubscribed emails are re-activated */
  async subscribe(email: string) {
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing?.status === 'subscribed') return;

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { status: 'subscribed', subscribedAt: new Date(), unsubscribedAt: null },
      create: { email },
    });
    emailService.queue({ email }, 'NEWSLETTER_WELCOME', { unsubscribeUrl: unsubscribeUrl(email) });
  },

  async unsubscribe(email: string, token: string) {
    if (!verifySignature(`newsletter:${email}`, token, env.JWT_ACCESS_SECRET)) {
      throw AppError.badRequest('This unsubscribe link is invalid');
    }
    await prisma.newsletterSubscriber.updateMany({
      where: { email, status: 'subscribed' },
      data: { status: 'unsubscribed', unsubscribedAt: new Date() },
    });
  },

  getAll: (query: SubscriberListQuery) => crud.getAll(query),

  async exportCsv(status: SubscriptionStatus) {
    const rows = await prisma.newsletterSubscriber.findMany({
      where: { status },
      orderBy: { subscribedAt: 'asc' },
    });
    const lines = [
      ['email', 'status', 'subscribed_at', 'unsubscribed_at'].join(','),
      ...rows.map((r) =>
        [r.email, r.status, r.subscribedAt.toISOString(), r.unsubscribedAt?.toISOString()]
          .map(csvCell)
          .join(','),
      ),
    ];
    return `${lines.join('\n')}\n`;
  },
};
