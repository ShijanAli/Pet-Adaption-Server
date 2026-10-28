import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { formLimiter } from '@/shared/middlewares/rateLimiter';
import { NewsletterController } from './newsletter.controller';
import { NewsletterValidation } from './newsletter.validation';

const r = createModuleRouter('/newsletter', 'Newsletter', 'Email newsletter subscriptions');

r.post(
  '/subscribe',
  {
    summary: 'Subscribe',
    access: 'public',
    before: [formLimiter],
    body: NewsletterValidation.subscribe,
    successStatus: 200,
  },
  NewsletterController.subscribe,
);
r.post(
  '/unsubscribe',
  {
    summary: 'Unsubscribe',
    description: 'Needs the signed `token` from the link in every newsletter email.',
    access: 'public',
    body: NewsletterValidation.unsubscribe,
    successStatus: 200,
  },
  NewsletterController.unsubscribe,
);
r.get(
  '/subscribers',
  {
    summary: 'List subscribers',
    access: { permissions: [P.NEWSLETTER.VIEW] },
    query: NewsletterValidation.listQuery,
  },
  NewsletterController.getAll,
);
r.get(
  '/subscribers/export',
  {
    summary: 'Download subscribers as CSV',
    access: { permissions: [P.NEWSLETTER.VIEW] },
    query: NewsletterValidation.exportQuery,
  },
  NewsletterController.exportCsv,
);

export const newsletterRoutes = r;
