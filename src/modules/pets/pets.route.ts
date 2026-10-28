import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { AdminPetController, MyPetController } from './pets.controller';
import { PetValidation } from './pets.validation';

/* ───────── Customer: /me/pets ───────── */
const me = createModuleRouter(
  '/me/pets',
  'My Pets',
  "The logged-in customer's own pets (used for bookings)",
);

me.get(
  '/',
  { summary: 'List my pets', access: 'auth', query: PetValidation.myListQuery },
  MyPetController.getAll,
);
me.post(
  '/',
  { summary: 'Add a pet', access: 'auth', body: PetValidation.create },
  MyPetController.create,
);
me.get('/:id', { summary: 'Get my pet', access: 'auth', params: idParam }, MyPetController.getById);
me.patch(
  '/:id',
  { summary: 'Update my pet', access: 'auth', params: idParam, body: PetValidation.update },
  MyPetController.update,
);
me.delete(
  '/:id',
  {
    summary: 'Delete my pet',
    description: 'Blocked while the pet has pending / confirmed / in-progress bookings.',
    access: 'auth',
    params: idParam,
  },
  MyPetController.remove,
);

/* ───────── Admin: /pets ───────── */
const admin = createModuleRouter(
  '/pets',
  'Pets (Admin)',
  "Read-only view of every customer's pets",
);

admin.get(
  '/',
  {
    summary: 'List all customer pets',
    description: 'Search: pet name, breed, owner email / name',
    access: { permissions: [P.PET.VIEW] },
    query: PetValidation.adminListQuery,
  },
  AdminPetController.getAll,
);
admin.get(
  '/:id',
  { summary: 'Get a pet with its owner', access: { permissions: [P.PET.VIEW] }, params: idParam },
  AdminPetController.getById,
);

export const myPetRoutes = me;
export const adminPetRoutes = admin;
