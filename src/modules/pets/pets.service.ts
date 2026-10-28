import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { assertIdsExist } from '@/shared/utils/db';
import {
  ACTIVE_BOOKING_STATUSES,
  adminPetInclude,
  adminPetQueryConfig,
  myPetQueryConfig,
  petInclude,
} from './pets.constant';
import type { CreatePetInput, PetListQuery, UpdatePetInput } from './pets.validation';

const myPets = createCrudService({
  delegate: () => prisma.pet,
  entityName: 'Pet',
  softDelete: true,
  queryConfig: myPetQueryConfig,
  include: petInclude,
});

const allPets = createCrudService({
  delegate: () => prisma.pet,
  entityName: 'Pet',
  softDelete: true,
  queryConfig: adminPetQueryConfig,
  include: adminPetInclude,
});

const assertActivePetType = (petTypeId?: number) =>
  petTypeId === undefined
    ? Promise.resolve()
    : assertIdsExist(prisma.petType, [petTypeId], 'pet type', { status: 'active' });

/** Customer side: every query is scoped to the logged-in owner */
export const MyPetService = {
  getAll: (userId: number, query: PetListQuery) => myPets.getAll(query, { userId }),

  getById: (userId: number, id: number) => myPets.getOne({ id, userId }),

  async create(userId: number, input: CreatePetInput) {
    await assertActivePetType(input.petTypeId);
    return myPets.create({ ...input, userId });
  },

  async update(userId: number, id: number, input: UpdatePetInput) {
    await myPets.getOne({ id, userId });
    await assertActivePetType(input.petTypeId);
    return myPets.update(id, input);
  },

  async remove(userId: number, id: number) {
    await myPets.getOne({ id, userId });
    const activeBookings = await prisma.booking.count({
      where: { petId: id, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
    });
    if (activeBookings > 0) {
      throw AppError.conflict(
        'This pet has upcoming bookings. Cancel them before deleting the pet',
      );
    }
    await myPets.remove(id);
  },
};

/** Admin side: read-only view of every customer's pets */
export const AdminPetService = {
  getAll: (query: PetListQuery) => allPets.getAll(query),
  getById: (id: number) => allPets.getById(id),
};
