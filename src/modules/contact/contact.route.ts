import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { formLimiter } from '@/shared/middlewares/rateLimiter';
import { idParam } from '@/shared/utils/validation';
import { ContactController } from './contact.controller';
import { ContactValidation } from './contact.validation';

const r = createModuleRouter('/contact', 'Contact', 'Contact form inbox');

r.post(
  '/',
  {
    summary: 'Send a contact message',
    description:
      'Rate limited (5 / hour / IP). The admin gets an email (setting `admin_notification_email`).',
    access: 'public',
    before: [formLimiter],
    body: ContactValidation.create,
  },
  ContactController.create,
);
r.get(
  '/',
  {
    summary: 'Inbox',
    access: { permissions: [P.CONTACT.VIEW] },
    query: ContactValidation.listQuery,
  },
  ContactController.getAll,
);
r.get(
  '/:id',
  {
    summary: 'Open a message (marks it read)',
    access: { permissions: [P.CONTACT.VIEW] },
    params: idParam,
  },
  ContactController.getById,
);
r.patch(
  '/:id/status',
  {
    summary: 'Set status (new / read / replied)',
    access: { permissions: [P.CONTACT.UPDATE] },
    params: idParam,
    body: ContactValidation.updateStatus,
  },
  ContactController.updateStatus,
);
r.delete(
  '/:id',
  { summary: 'Delete a message', access: { permissions: [P.CONTACT.UPDATE] }, params: idParam },
  ContactController.remove,
);

export const contactRoutes = r;
