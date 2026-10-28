import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { FaqController } from './faqs.controller';
import { FaqValidation } from './faqs.validation';

const r = createModuleRouter('/faqs', 'FAQs', 'Frequently asked questions');

r.get(
  '/',
  {
    summary: 'List FAQs',
    description: 'Use `grouped=true` for the FAQ page.',
    access: 'optional',
    query: FaqValidation.listQuery,
  },
  FaqController.getAll,
);
r.get(
  '/:id',
  { summary: 'Get an FAQ', access: 'optional', params: idParam },
  FaqController.getById,
);
r.post(
  '/',
  { summary: 'Create an FAQ', access: { permissions: [P.FAQ.CREATE] }, body: FaqValidation.create },
  FaqController.create,
);
r.patch(
  '/:id',
  {
    summary: 'Update an FAQ',
    access: { permissions: [P.FAQ.UPDATE] },
    params: idParam,
    body: FaqValidation.update,
  },
  FaqController.update,
);
r.delete(
  '/:id',
  { summary: 'Delete an FAQ', access: { permissions: [P.FAQ.DELETE] }, params: idParam },
  FaqController.remove,
);

export const faqRoutes = r;
