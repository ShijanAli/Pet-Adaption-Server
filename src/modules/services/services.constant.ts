import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export const SERVICE_SORTABLE_FIELDS = [
  'sortOrder',
  'createdAt',
  'price',
  'name',
  'avgRating',
  'durationMinutes',
] as const;

export const serviceQueryConfig: QueryBuilderConfig = {
  searchableFields: ['name', 'shortDescription', 'category.name'],
  filterableFields: {
    categoryId: 'categoryId',
    category: 'category.slug',
    petTypeId: 'petTypes.some.petTypeId',
    petType: 'petTypes.some.petType.slug',
    staffId: 'staff.some.staffId',
    isFeatured: 'isFeatured',
    requiresVaccination: 'requiresVaccination',
    status: 'status',
  },
  rangeFields: {
    minPrice: ['price', 'gte'],
    maxPrice: ['price', 'lte'],
    maxDuration: ['durationMinutes', 'lte'],
  },
};

/** Roles that can be assigned as service providers (anyone but customers) */
export const NON_PROVIDER_ROLE = 'customer';

const petTypesSelect = {
  select: { petType: { select: { id: true, name: true, slug: true } } },
} as const;

export const serviceListInclude = {
  category: { select: { id: true, name: true, slug: true } },
  petTypes: petTypesSelect,
} as const;

export const serviceDetailInclude = {
  ...serviceListInclude,
  staff: {
    where: { staff: { status: 'active' as const, deletedAt: null } },
    select: {
      staff: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
    },
  },
} as const;

/** Bookings in these states block deleting a service / changing its duration */
export const OPEN_BOOKING_STATUSES = ['pending', 'confirmed', 'in_progress'] as const;
