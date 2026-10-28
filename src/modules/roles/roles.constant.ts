import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export const ROLE_SORTABLE_FIELDS = ['createdAt', 'name'] as const;

export const roleQueryConfig: QueryBuilderConfig = {
  searchableFields: ['name', 'slug', 'description'],
  filterableFields: ['status', 'isSystem'],
};

export const roleListInclude = {
  _count: { select: { users: true, permissions: true } },
} as const;

export const roleDetailInclude = {
  _count: { select: { users: true } },
  permissions: {
    select: { permission: { select: { id: true, name: true, slug: true, module: true } } },
    orderBy: { permission: { slug: 'asc' } },
  },
} as const;
