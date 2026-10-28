import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

/** Role fields embedded in every user response */
export const userRoleInclude = {
  role: { select: { id: true, name: true, slug: true } },
} as const;

export const USER_SORTABLE_FIELDS = [
  'createdAt',
  'firstName',
  'lastName',
  'email',
  'lastLoginAt',
] as const;

export const userQueryConfig: QueryBuilderConfig = {
  searchableFields: ['firstName', 'lastName', 'email', 'phone'],
  filterableFields: { roleId: 'roleId', status: 'status', role: 'role.slug' },
};
