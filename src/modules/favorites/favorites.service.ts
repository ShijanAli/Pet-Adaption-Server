import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { buildListQuery, buildMeta, type BaseListQuery } from '@/shared/utils/queryBuilder';
import { PUBLIC_STATUSES } from '@/modules/adoption-pets/adoption-pets.constant';

export const FavoriteService = {
  async getMine(userId: number, query: BaseListQuery) {
    const q = buildListQuery(query, {
      searchableFields: ['adoptionPet.name', 'adoptionPet.breed'],
      // hide pets that were deleted in the meantime
      baseWhere: { userId, adoptionPet: { deletedAt: null } },
    });
    const [rows, total] = await Promise.all([
      prisma.favorite.findMany({
        where: q.where,
        orderBy: q.orderBy,
        skip: q.skip,
        take: q.take,
        include: {
          adoptionPet: {
            include: {
              petType: { select: { id: true, name: true, slug: true } },
              images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
            },
          },
        },
      }),
      prisma.favorite.count({ where: q.where }),
    ]);

    return {
      data: rows.map(({ adoptionPet: { images, ...pet }, createdAt }) => ({
        ...pet,
        primaryImage: images[0]?.imageUrl ?? null,
        favoritedAt: createdAt,
      })),
      meta: buildMeta(total, q.page, q.limit),
    };
  },

  /** Idempotent — adding twice is fine */
  async add(userId: number, adoptionPetId: number) {
    const pet = await prisma.adoptionPet.findFirst({
      where: { id: adoptionPetId, status: { in: PUBLIC_STATUSES } },
      select: { id: true },
    });
    if (!pet) throw AppError.notFound('Adoption pet');
    await prisma.favorite.upsert({
      where: { userId_adoptionPetId: { userId, adoptionPetId } },
      update: {},
      create: { userId, adoptionPetId },
    });
  },

  async remove(userId: number, adoptionPetId: number) {
    await prisma.favorite.deleteMany({ where: { userId, adoptionPetId } });
  },
};
