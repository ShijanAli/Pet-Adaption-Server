import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idOrSlugParam, idParam } from '@/shared/utils/validation';
import { ServiceController } from './services.controller';
import { ServiceValidation } from './services.validation';

const r = createModuleRouter('/services', 'Services', 'Pet care service catalog');

r.get(
  '/',
  {
    summary: 'List services',
    description:
      'Search: name, short description, category name. Filters: category / categoryId, petType / petTypeId, ' +
      'staffId, isFeatured, minPrice, maxPrice, maxDuration. Public sees active services in active categories only.',
    access: 'optional',
    query: ServiceValidation.listQuery,
  },
  ServiceController.getAll,
);

r.get(
  '/:idOrSlug',
  {
    summary: 'Get a service by id or slug',
    description: 'Includes category, pet types and the staff who provide it.',
    access: 'optional',
    params: idOrSlugParam,
  },
  ServiceController.getOne,
);

r.post(
  '/',
  {
    summary: 'Create a service',
    description: 'Prices are in the base currency (BDT).',
    access: { permissions: [P.SERVICE.CREATE] },
    body: ServiceValidation.create,
  },
  ServiceController.create,
);

r.patch(
  '/:id',
  {
    summary: 'Update a service',
    description: 'Sending `petTypeIds` / `staffIds` replaces the current list.',
    access: { permissions: [P.SERVICE.UPDATE] },
    params: idParam,
    body: ServiceValidation.update,
  },
  ServiceController.update,
);

r.patch(
  '/:id/status',
  {
    summary: 'Activate / deactivate a service',
    access: { permissions: [P.SERVICE.UPDATE] },
    params: idParam,
    body: ServiceValidation.updateStatus,
  },
  ServiceController.updateStatus,
);

r.put(
  '/:id/pet-types',
  {
    summary: 'Replace the pet types a service supports',
    access: { permissions: [P.SERVICE.UPDATE] },
    params: idParam,
    body: ServiceValidation.setPetTypes,
  },
  ServiceController.setPetTypes,
);

r.put(
  '/:id/staff',
  {
    summary: 'Replace the staff who provide a service',
    access: { permissions: [P.SERVICE.UPDATE] },
    params: idParam,
    body: ServiceValidation.setStaff,
  },
  ServiceController.setStaff,
);

r.delete(
  '/:id',
  {
    summary: 'Delete a service (soft delete)',
    description: 'Blocked while the service has open bookings — deactivate it instead.',
    access: { permissions: [P.SERVICE.DELETE] },
    params: idParam,
  },
  ServiceController.remove,
);

export const serviceRoutes = r;
