import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idOrSlugParam, idParam } from '@/shared/utils/validation';
import { PetTypeController } from './pet-types.controller';
import { PetTypeValidation } from './pet-types.validation';

const r = createModuleRouter(
  '/pet-types',
  'Pet Types',
  'Dog, Cat, Bird … used by pets, services and adoption',
);

r.get(
  '/',
  {
    summary: 'List pet types',
    description:
      'Public sees active only. With `pet_type.update` permission inactive ones are included.',
    access: 'optional',
    query: PetTypeValidation.listQuery,
  },
  PetTypeController.getAll,
);

r.get(
  '/:idOrSlug',
  { summary: 'Get a pet type by id or slug', access: 'optional', params: idOrSlugParam },
  PetTypeController.getOne,
);

r.post(
  '/',
  {
    summary: 'Create a pet type',
    access: { permissions: [P.PET_TYPE.CREATE] },
    body: PetTypeValidation.create,
  },
  PetTypeController.create,
);

r.patch(
  '/:id',
  {
    summary: 'Update a pet type',
    access: { permissions: [P.PET_TYPE.UPDATE] },
    params: idParam,
    body: PetTypeValidation.update,
  },
  PetTypeController.update,
);

r.delete(
  '/:id',
  {
    summary: 'Delete a pet type',
    description: 'Only when no pet / service / adoption listing uses it — otherwise deactivate it.',
    access: { permissions: [P.PET_TYPE.DELETE] },
    params: idParam,
  },
  PetTypeController.remove,
);

export const petTypeRoutes = r;
