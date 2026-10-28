import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { assertIdsExist } from '@/shared/utils/db';
import { whereIdOrSlug } from '@/shared/utils/validation';
import {
  adoptionPetDetailInclude,
  adoptionPetListInclude,
  adoptionPetQueryConfig,
  MAX_IMAGES_PER_PET,
  OPEN_APPLICATION_STATUSES,
  PUBLIC_STATUSES,
} from './adoption-pets.constant';
import type {
  CreateAdoptionPetInput,
  ImageInput,
  ListAdoptionPetsQuery,
  UpdateAdoptionPetInput,
} from './adoption-pets.validation';

export type Viewer = { canManage: boolean; userId?: number };

const crud = createCrudService({
  delegate: () => prisma.adoptionPet,
  entityName: 'Adoption pet',
  softDelete: true,
  slugFrom: 'name',
  queryConfig: adoptionPetQueryConfig,
  listInclude: adoptionPetListInclude,
});

type ListRow = { id: number; images: { imageUrl: string }[] };

/** Adds `isFavorite` for logged-in users */
const withFavorites = async <T extends { id: number }>(rows: T[], userId?: number) => {
  if (!userId || !rows.length) return rows.map((r) => ({ ...r, isFavorite: false }));
  const favs = await prisma.favorite.findMany({
    where: { userId, adoptionPetId: { in: rows.map((r) => r.id) } },
    select: { adoptionPetId: true },
  });
  const ids = new Set(favs.map((f) => f.adoptionPetId));
  return rows.map((r) => ({ ...r, isFavorite: ids.has(r.id) }));
};

/** At most one primary image; the first becomes primary when nothing is primary yet */
const normalizeImages = (images: ImageInput[], hasPrimaryAlready: boolean, startOrder = 0) => {
  const primaryIndex = images.findIndex((i) => i.isPrimary);
  const chosen = primaryIndex >= 0 ? primaryIndex : hasPrimaryAlready ? -1 : 0;
  return images.map((img, i) => ({
    imageUrl: img.imageUrl,
    isPrimary: i === chosen,
    sortOrder: startOrder + i,
  }));
};

const assertPetType = (petTypeId?: number) =>
  petTypeId === undefined
    ? undefined
    : assertIdsExist(prisma.petType, [petTypeId], 'pet type', { status: 'active' });

const getPetOrThrow = async (id: number) => {
  const pet = await prisma.adoptionPet.findUnique({ where: { id } });
  if (!pet) throw AppError.notFound('Adoption pet');
  return pet;
};

export const AdoptionPetService = {
  async getAll(query: ListAdoptionPetsQuery, viewer: Viewer) {
    let extraWhere = {};
    if (!viewer.canManage) {
      // the public can't see adopted / on-hold animals
      const wanted =
        query.status && PUBLIC_STATUSES.includes(query.status) ? query.status : undefined;
      query = { ...query, status: wanted };
      extraWhere = wanted ? {} : { status: { in: PUBLIC_STATUSES } };
    }
    const { data, meta } = await crud.getAll(query, extraWhere);
    const rows = (data as ListRow[]).map(({ images, ...pet }) => ({
      ...pet,
      primaryImage: images[0]?.imageUrl ?? null,
    }));
    return { data: await withFavorites(rows, viewer.userId), meta };
  },

  async getByIdOrSlug(idOrSlug: string, viewer: Viewer) {
    const pet = await prisma.adoptionPet.findFirst({
      where: {
        ...whereIdOrSlug(idOrSlug),
        ...(!viewer.canManage && { status: { in: PUBLIC_STATUSES } }),
      },
      include: adoptionPetDetailInclude,
    });
    if (!pet) throw AppError.notFound('Adoption pet');
    const [withFav] = await withFavorites([pet], viewer.userId);
    return withFav;
  },

  getDetail: (id: number) => AdoptionPetService.getByIdOrSlug(String(id), { canManage: true }),

  async create(actorId: number, { images, slug, ...input }: CreateAdoptionPetInput) {
    await assertPetType(input.petTypeId);
    const pet = await prisma.adoptionPet.create({
      data: {
        ...input,
        slug: await crud.ensureUniqueSlug(slug ?? input.name),
        createdById: actorId,
        images: { create: normalizeImages(images, false) },
      },
    });
    return AdoptionPetService.getDetail(pet.id);
  },

  async update(id: number, { slug, ...input }: UpdateAdoptionPetInput) {
    await getPetOrThrow(id);
    await assertPetType(input.petTypeId);
    await prisma.adoptionPet.update({
      where: { id },
      data: { ...input, ...(slug && { slug: await crud.ensureUniqueSlug(slug, id) }) },
    });
    return AdoptionPetService.getDetail(id);
  },

  async updateStatus(id: number, status: 'available' | 'on_hold') {
    const pet = await getPetOrThrow(id);
    if (pet.status === 'pending' || pet.status === 'adopted') {
      throw AppError.conflict(
        `This pet is ${pet.status} — its status is managed by the adoption workflow`,
      );
    }
    await prisma.adoptionPet.update({ where: { id }, data: { status } });
    return AdoptionPetService.getDetail(id);
  },

  async remove(id: number) {
    await getPetOrThrow(id);
    const [openApplications, adoptions] = await Promise.all([
      prisma.adoptionApplication.count({
        where: { adoptionPetId: id, status: { in: [...OPEN_APPLICATION_STATUSES] } },
      }),
      prisma.adoption.count({ where: { adoptionPetId: id } }),
    ]);
    if (openApplications || adoptions) {
      throw AppError.conflict(
        'This pet has open applications or an adoption record and cannot be deleted',
      );
    }
    await crud.remove(id);
  },

  /* ───── images ───── */

  async addImages(id: number, images: ImageInput[]) {
    await getPetOrThrow(id);
    const existing = await prisma.adoptionPetImage.findMany({ where: { adoptionPetId: id } });
    if (existing.length + images.length > MAX_IMAGES_PER_PET) {
      throw AppError.badRequest(`A pet can have at most ${MAX_IMAGES_PER_PET} images`);
    }
    const rows = normalizeImages(
      images,
      existing.some((i) => i.isPrimary),
      Math.max(-1, ...existing.map((i) => i.sortOrder)) + 1,
    );
    await prisma.$transaction(async (tx) => {
      if (rows.some((r) => r.isPrimary)) {
        await tx.adoptionPetImage.updateMany({
          where: { adoptionPetId: id },
          data: { isPrimary: false },
        });
      }
      await tx.adoptionPetImage.createMany({
        data: rows.map((r) => ({ ...r, adoptionPetId: id })),
      });
    });
    return AdoptionPetService.getDetail(id);
  },

  async setPrimaryImage(id: number, imageId: number) {
    const image = await prisma.adoptionPetImage.findFirst({
      where: { id: imageId, adoptionPetId: id },
    });
    if (!image) throw AppError.notFound('Image');
    await prisma.$transaction([
      prisma.adoptionPetImage.updateMany({
        where: { adoptionPetId: id },
        data: { isPrimary: false },
      }),
      prisma.adoptionPetImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
    ]);
    return AdoptionPetService.getDetail(id);
  },

  async removeImage(id: number, imageId: number) {
    const image = await prisma.adoptionPetImage.findFirst({
      where: { id: imageId, adoptionPetId: id },
    });
    if (!image) throw AppError.notFound('Image');
    await prisma.$transaction(async (tx) => {
      await tx.adoptionPetImage.delete({ where: { id: imageId } });
      if (image.isPrimary) {
        // promote the next image
        const next = await tx.adoptionPetImage.findFirst({
          where: { adoptionPetId: id },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });
        if (next)
          await tx.adoptionPetImage.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    });
    return AdoptionPetService.getDetail(id);
  },
};
