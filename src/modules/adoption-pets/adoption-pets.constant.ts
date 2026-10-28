import type { AdoptionPetStatus } from '@generated/prisma/client';
import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export const ADOPTION_PET_SORTABLE_FIELDS = [
  'createdAt',
  'name',
  'ageMonths',
  'adoptionFee',
] as const;

/** What the public site shows ("pending" = adoption in progress) */
export const PUBLIC_STATUSES: AdoptionPetStatus[] = ['available', 'pending'];

/** Applications in these states are "open" */
export const OPEN_APPLICATION_STATUSES = ['pending', 'under_review'] as const;

export const MAX_IMAGES_PER_PET = 10;

export const adoptionPetQueryConfig: QueryBuilderConfig = {
  searchableFields: ['name', 'breed', 'color', 'description'],
  filterableFields: {
    petTypeId: 'petTypeId',
    petType: 'petType.slug',
    gender: 'gender',
    size: 'size',
    isVaccinated: 'isVaccinated',
    isNeutered: 'isNeutered',
    isFeatured: 'isFeatured',
    status: 'status',
  },
  rangeFields: {
    minAgeMonths: ['ageMonths', 'gte'],
    maxAgeMonths: ['ageMonths', 'lte'],
    maxFee: ['adoptionFee', 'lte'],
  },
};

const imageOrder = [
  { isPrimary: 'desc' as const },
  { sortOrder: 'asc' as const },
  { id: 'asc' as const },
];

export const adoptionPetListInclude = {
  petType: { select: { id: true, name: true, slug: true } },
  images: { orderBy: imageOrder, take: 1 },
  _count: { select: { favorites: true } },
} as const;

export const adoptionPetDetailInclude = {
  petType: { select: { id: true, name: true, slug: true } },
  images: { orderBy: imageOrder },
  _count: { select: { favorites: true } },
} as const;
