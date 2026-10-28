import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export const CATEGORY_SORTABLE_FIELDS = ['sortOrder', 'name', 'createdAt'] as const;

export const categoryQueryConfig: QueryBuilderConfig = {
  searchableFields: ['name', 'slug', 'description'],
  filterableFields: ['status', 'parentId'],
};

// soft-deleted relations must be filtered manually inside includes
const notDeleted = { deletedAt: null } as const;

export const categoryInclude = {
  parent: { select: { id: true, name: true, slug: true } },
  _count: { select: { services: { where: notDeleted }, children: { where: notDeleted } } },
} as const;

export const categoryDetailInclude = (activeOnly: boolean) =>
  ({
    parent: { select: { id: true, name: true, slug: true } },
    children: {
      where: { ...notDeleted, ...(activeOnly && { status: 'active' as const }) },
      orderBy: { sortOrder: 'asc' as const },
    },
    _count: { select: { services: { where: notDeleted } } },
  }) as const;
