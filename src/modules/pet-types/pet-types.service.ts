import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { whereIdOrSlug } from '@/shared/utils/validation';
import { petTypeQueryConfig } from './pet-types.constant';
import type { ListPetTypesQuery } from './pet-types.validation';

const crud = createCrudService({
  delegate: () => prisma.petType,
  entityName: 'Pet type',
  slugFrom: 'name',
  queryConfig: petTypeQueryConfig,
});

export const PetTypeService = {
  ...crud,

  /** Public callers only ever see active pet types */
  getAll(query: ListPetTypesQuery, canManage: boolean) {
    return crud.getAll(canManage ? query : { ...query, status: 'active' });
  },

  getByIdOrSlug(idOrSlug: string, canManage: boolean) {
    return crud.getOne({ ...whereIdOrSlug(idOrSlug), ...(!canManage && { status: 'active' }) });
  },

  async remove(id: number) {
    await crud.getById(id);
    const [pets, services, adoptionPets] = await Promise.all([
      prisma.pet.count({ where: { petTypeId: id, deletedAt: undefined } }),
      prisma.servicePetType.count({ where: { petTypeId: id } }),
      prisma.adoptionPet.count({ where: { petTypeId: id, deletedAt: undefined } }),
    ]);
    if (pets + services + adoptionPets > 0) {
      throw AppError.conflict(
        'This pet type is in use by pets, services or adoption listings. Deactivate it instead',
      );
    }
    await prisma.petType.delete({ where: { id } });
  },
};
