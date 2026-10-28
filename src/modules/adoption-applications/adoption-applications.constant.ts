import type { ApplicationStatus, Prisma } from '@generated/prisma/client';
import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export { OPEN_APPLICATION_STATUSES } from '@/modules/adoption-pets/adoption-pets.constant';

export const APPLICATION_SORTABLE_FIELDS = ['createdAt', 'reviewedAt', 'status'] as const;

/** Allowed review decisions */
export const REVIEW_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  pending: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: [],
  rejected: [],
  cancelled: [],
};

const imageOrder: Prisma.AdoptionPetImageOrderByWithRelationInput[] = [
  { isPrimary: 'desc' },
  { sortOrder: 'asc' },
];

const petSummary = {
  select: {
    id: true,
    name: true,
    slug: true,
    status: true,
    adoptionFee: true,
    petType: { select: { id: true, name: true, slug: true } },
    images: { orderBy: imageOrder, take: 1 },
  },
} as const;

export const myApplicationInclude = {
  adoptionPet: petSummary,
  adoption: { select: { id: true, status: true, feeAmount: true, feePaid: true } },
} as const;

export const adminApplicationInclude = {
  ...myApplicationInclude,
  user: {
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, address: true },
  },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

export const myApplicationQueryConfig: QueryBuilderConfig = {
  searchableFields: ['applicationNo', 'adoptionPet.name'],
  filterableFields: ['status', 'adoptionPetId'],
};

export const adminApplicationQueryConfig: QueryBuilderConfig = {
  searchableFields: [
    'applicationNo',
    'adoptionPet.name',
    'user.email',
    'user.firstName',
    'user.lastName',
  ],
  filterableFields: [
    'status',
    'adoptionPetId',
    'userId',
    'homeType',
    'hasChildren',
    'hasOtherPets',
  ],
};
