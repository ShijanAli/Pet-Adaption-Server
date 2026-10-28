import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export const PET_SORTABLE_FIELDS = ['createdAt', 'name'] as const;

export const petInclude = {
  petType: { select: { id: true, name: true, slug: true } },
} as const;

export const adminPetInclude = {
  ...petInclude,
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
} as const;

export const myPetQueryConfig: QueryBuilderConfig = {
  searchableFields: ['name', 'breed'],
  filterableFields: ['petTypeId', 'size', 'gender'],
};

export const adminPetQueryConfig: QueryBuilderConfig = {
  searchableFields: ['name', 'breed', 'user.email', 'user.firstName', 'user.lastName'],
  filterableFields: ['petTypeId', 'size', 'gender', 'userId', 'isVaccinated'],
};

/** Bookings in these states keep a pet from being deleted */
export const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'in_progress'] as const;
