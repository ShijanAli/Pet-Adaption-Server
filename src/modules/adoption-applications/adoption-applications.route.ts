import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { ApplicationController } from './adoption-applications.controller';
import { ApplicationValidation } from './adoption-applications.validation';

const r = createModuleRouter(
  '/adoption-applications',
  'Adoption Applications',
  'Apply to adopt + review workflow',
);

r.post(
  '/',
  {
    summary: 'Apply to adopt a pet',
    description:
      'Only `available` pets accept applications; one open application per pet per user.',
    access: 'auth',
    body: ApplicationValidation.create,
  },
  ApplicationController.apply,
);

r.get(
  '/',
  {
    summary: 'List applications',
    description: 'Search: application no, pet name, applicant email / name.',
    access: { permissions: [P.ADOPTION_APPLICATION.VIEW] },
    query: ApplicationValidation.adminListQuery,
  },
  ApplicationController.getAll,
);

r.get(
  '/:id',
  {
    summary: 'Application detail',
    access: { permissions: [P.ADOPTION_APPLICATION.VIEW] },
    params: idParam,
  },
  ApplicationController.getById,
);

r.patch(
  '/:id/review',
  {
    summary: 'Review an application',
    description:
      'pending → under_review | approved | rejected · under_review → approved | rejected. ' +
      'Approving locks the pet (status `pending`), creates the adoption record and auto-rejects the other open applications.',
    access: { permissions: [P.ADOPTION_APPLICATION.REVIEW] },
    params: idParam,
    body: ApplicationValidation.review,
  },
  ApplicationController.review,
);

const me = createModuleRouter(
  '/me/adoption-applications',
  'My Adoption Applications',
  "The logged-in user's applications",
);

me.get(
  '/',
  { summary: 'List my applications', access: 'auth', query: ApplicationValidation.myListQuery },
  ApplicationController.getMine,
);

me.get(
  '/:idOrNo',
  {
    summary: 'Get my application by id or number',
    access: 'auth',
    params: ApplicationValidation.idOrNoParam,
  },
  ApplicationController.getMineOne,
);

me.patch(
  '/:idOrNo/cancel',
  {
    summary: 'Withdraw my application',
    description: 'Only pending / under-review applications.',
    access: 'auth',
    params: ApplicationValidation.idOrNoParam,
    body: ApplicationValidation.cancel,
  },
  ApplicationController.cancelMine,
);

export const applicationRoutes = r;
export const myApplicationRoutes = me;
