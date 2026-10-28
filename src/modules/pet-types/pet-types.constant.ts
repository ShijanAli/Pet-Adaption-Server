import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export const PET_TYPE_SORTABLE_FIELDS = ['name', 'createdAt'] as const;

export const petTypeQueryConfig: QueryBuilderConfig = {
  searchableFields: ['name', 'slug'],
  filterableFields: ['status'],
};
