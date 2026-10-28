import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { AdoptionController } from './adoptions.controller';
import { AdoptionValidation } from './adoptions.validation';

const r = createModuleRouter(
  '/adoptions',
  'Adoptions',
  'Created when an application is approved: in_progress → completed (handover) | cancelled',
);

r.get(
  '/',
  {
    summary: 'List adoptions',
    access: { permissions: [P.ADOPTION.VIEW] },
    query: AdoptionValidation.adminListQuery,
  },
  AdoptionController.getAll,
);

r.get(
  '/:id',
  {
    summary: 'Adoption detail with payments',
    access: { permissions: [P.ADOPTION.VIEW] },
    params: idParam,
  },
  AdoptionController.getById,
);

r.patch(
  '/:id',
  {
    summary: 'Update handover date / contract / follow-up date',
    access: { permissions: [P.ADOPTION.UPDATE] },
    params: idParam,
    body: AdoptionValidation.update,
  },
  AdoptionController.update,
);

r.patch(
  '/:id/complete',
  {
    summary: 'Complete the adoption (handover)',
    description: 'Requires the adoption fee to be fully paid. Marks the pet as `adopted`.',
    access: { permissions: [P.ADOPTION.UPDATE] },
    params: idParam,
    body: AdoptionValidation.complete,
  },
  AdoptionController.complete,
);

r.patch(
  '/:id/cancel',
  {
    summary: 'Cancel an approved adoption',
    description:
      'Only when no fee has been paid (refund first). The pet becomes `available` again.',
    access: { permissions: [P.ADOPTION.UPDATE] },
    params: idParam,
    body: AdoptionValidation.cancel,
  },
  AdoptionController.cancel,
);

const me = createModuleRouter('/me/adoptions', 'My Adoptions', "The logged-in user's adoptions");

me.get(
  '/',
  { summary: 'List my adoptions', access: 'auth', query: AdoptionValidation.myListQuery },
  AdoptionController.getMine,
);
me.get(
  '/:id',
  { summary: 'Get my adoption', access: 'auth', params: idParam },
  AdoptionController.getMineById,
);

export const adoptionRoutes = r;
export const myAdoptionRoutes = me;
