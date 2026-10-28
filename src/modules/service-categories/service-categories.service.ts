import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { whereIdOrSlug } from '@/shared/utils/validation';
import {
  categoryDetailInclude,
  categoryInclude,
  categoryQueryConfig,
} from './service-categories.constant';
import type {
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from './service-categories.validation';

const crud = createCrudService({
  delegate: () => prisma.serviceCategory,
  entityName: 'Service category',
  softDelete: true,
  slugFrom: 'name',
  queryConfig: categoryQueryConfig,
  include: categoryInclude,
});

/**
 * Categories are max 2 levels deep (Grooming → Bath & Brush).
 * That keeps menus simple and makes cycles impossible.
 */
const assertValidParent = async (parentId: number | null | undefined, selfId?: number) => {
  if (!parentId) return;
  if (parentId === selfId) throw AppError.badRequest('A category cannot be its own parent');

  const parent = await prisma.serviceCategory.findUnique({ where: { id: parentId } });
  if (!parent) throw AppError.badRequest('Parent category does not exist');
  if (parent.parentId)
    throw AppError.badRequest('Sub-categories cannot have their own sub-categories');

  if (selfId) {
    const children = await prisma.serviceCategory.count({ where: { parentId: selfId } });
    if (children > 0) {
      throw AppError.badRequest(
        'This category has sub-categories, so it cannot become a sub-category',
      );
    }
  }
};

export const ServiceCategoryService = {
  getAll(query: ListCategoriesQuery, canManage: boolean) {
    const { rootOnly, ...rest } = query;
    return crud.getAll(
      canManage ? rest : { ...rest, status: 'active' },
      rootOnly ? { parentId: null } : {},
    );
  },

  /** Full menu tree: top-level categories with their active children */
  getTree(canManage: boolean) {
    const status = canManage ? {} : { status: 'active' as const };
    return prisma.serviceCategory.findMany({
      where: { parentId: null, ...status },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        children: {
          where: { deletedAt: null, ...status },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });
  },

  async getByIdOrSlug(idOrSlug: string, canManage: boolean) {
    const category = await prisma.serviceCategory.findFirst({
      where: { ...whereIdOrSlug(idOrSlug), ...(!canManage && { status: 'active' }) },
      include: categoryDetailInclude(!canManage),
    });
    if (!category) throw AppError.notFound('Service category');
    return category;
  },

  async create(input: CreateCategoryInput) {
    await assertValidParent(input.parentId);
    return crud.create(input);
  },

  async update(id: number, input: UpdateCategoryInput) {
    await crud.getById(id);
    await assertValidParent(input.parentId, id);
    return crud.update(id, input);
  },

  async remove(id: number) {
    await crud.getById(id);
    const [children, services] = await Promise.all([
      prisma.serviceCategory.count({ where: { parentId: id } }),
      prisma.service.count({ where: { categoryId: id } }),
    ]);
    if (children || services) {
      throw AppError.conflict(
        `Category has ${children} sub-categories and ${services} services. Move or delete them first`,
      );
    }
    await crud.remove(id);
  },
};
