import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idOrSlugParam, idParam } from '@/shared/utils/validation';
import { AdoptionPetController } from './adoption-pets.controller';
import { AdoptionPetValidation } from './adoption-pets.validation';

const r = createModuleRouter('/adoption-pets', 'Adoption Pets', 'Animals listed for adoption');

r.get(
  '/',
  {
    summary: 'List adoption pets',
    description:
      'Public sees `available` + `pending` (adoption in progress). Logged-in users get `isFavorite`. ' +
      'Filters: petType / petTypeId, gender, size, isVaccinated, isNeutered, isFeatured, minAgeMonths, maxAgeMonths, maxFee.',
    access: 'optional',
    query: AdoptionPetValidation.listQuery,
  },
  AdoptionPetController.getAll,
);

r.get(
  '/:idOrSlug',
  { summary: 'Get an adoption pet with all images', access: 'optional', params: idOrSlugParam },
  AdoptionPetController.getOne,
);

r.post(
  '/',
  {
    summary: 'List a pet for adoption',
    description:
      'Upload images first (`POST /uploads/images?folder=adoption-pets`) and send their URLs.',
    access: { permissions: [P.ADOPTION_PET.CREATE] },
    body: AdoptionPetValidation.create,
  },
  AdoptionPetController.create,
);

r.patch(
  '/:id',
  {
    summary: 'Update an adoption pet',
    access: { permissions: [P.ADOPTION_PET.UPDATE] },
    params: idParam,
    body: AdoptionPetValidation.update,
  },
  AdoptionPetController.update,
);

r.patch(
  '/:id/status',
  {
    summary: 'Put on hold / make available again',
    description: '`pending` and `adopted` are set by the adoption workflow, not manually.',
    access: { permissions: [P.ADOPTION_PET.UPDATE] },
    params: idParam,
    body: AdoptionPetValidation.updateStatus,
  },
  AdoptionPetController.updateStatus,
);

r.delete(
  '/:id',
  {
    summary: 'Delete an adoption pet (soft delete)',
    description: 'Blocked when it has open applications or an adoption record.',
    access: { permissions: [P.ADOPTION_PET.DELETE] },
    params: idParam,
  },
  AdoptionPetController.remove,
);

r.post(
  '/:id/images',
  {
    summary: 'Add images',
    access: { permissions: [P.ADOPTION_PET.UPDATE] },
    params: idParam,
    body: AdoptionPetValidation.addImages,
  },
  AdoptionPetController.addImages,
);

r.patch(
  '/:id/images/:imageId/primary',
  {
    summary: 'Make an image the cover image',
    access: { permissions: [P.ADOPTION_PET.UPDATE] },
    params: AdoptionPetValidation.imageParams,
  },
  AdoptionPetController.setPrimaryImage,
);

r.delete(
  '/:id/images/:imageId',
  {
    summary: 'Remove an image',
    access: { permissions: [P.ADOPTION_PET.UPDATE] },
    params: AdoptionPetValidation.imageParams,
  },
  AdoptionPetController.removeImage,
);

export const adoptionPetRoutes = r;
