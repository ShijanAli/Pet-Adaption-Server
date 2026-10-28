import { prisma } from '@/lib/prisma';
import { createCrudService } from '@/shared/crud/crud.factory';
import { assertIdsExist } from '@/shared/utils/db';
import type { TestimonialInput, TestimonialListQuery } from './testimonials.validation';

const crud = createCrudService({
  delegate: () => prisma.testimonial,
  entityName: 'Testimonial',
  queryConfig: {
    searchableFields: ['name', 'content'],
    filterableFields: ['isFeatured', 'rating', 'status'],
  },
  include: {
    adoption: { select: { id: true, adoptionPet: { select: { name: true, slug: true } } } },
  },
});

const assertLinks = async (input: TestimonialInput) => {
  await Promise.all([
    input.userId ? assertIdsExist(prisma.user, [input.userId], 'user') : undefined,
    input.adoptionId ? assertIdsExist(prisma.adoption, [input.adoptionId], 'adoption') : undefined,
  ]);
};

export const TestimonialService = {
  getAll: (query: TestimonialListQuery, canManage: boolean) =>
    crud.getAll(canManage ? query : { ...query, status: 'active' }),

  getVisible: (id: number, canManage: boolean) =>
    crud.getOne({ id, ...(!canManage && { status: 'active' }) }),

  async create(input: TestimonialInput) {
    await assertLinks(input);
    return crud.create(input);
  },

  async update(id: number, input: TestimonialInput) {
    await assertLinks(input);
    return crud.update(id, input);
  },

  remove: crud.remove,
};
