import type { Prisma } from '@generated/prisma/client';
import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export const ADOPTION_SORTABLE_FIELDS = ['createdAt', 'adoptionDate', 'completedAt'] as const;

const imageOrder: Prisma.AdoptionPetImageOrderByWithRelationInput[] = [
  { isPrimary: 'desc' },
  { sortOrder: 'asc' },
];

export const adoptionInclude = {
  adoptionPet: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      petType: { select: { id: true, name: true, slug: true } },
      images: { orderBy: imageOrder, take: 1 },
    },
  },
  application: { select: { id: true, applicationNo: true } },
} as const;

export const adminAdoptionInclude = {
  ...adoptionInclude,
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
} as const;

export const adoptionDetailInclude = {
  ...adminAdoptionInclude,
  application: true,
  payments: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      type: true,
      method: true,
      status: true,
      amount: true,
      currency: true,
      baseAmount: true,
      transactionId: true,
      paidAt: true,
    },
  },
} as const;

const range: QueryBuilderConfig['rangeFields'] = {
  from: ['adoptionDate', 'gte'],
  to: ['adoptionDate', 'lte'],
};

export const myAdoptionQueryConfig: QueryBuilderConfig = {
  searchableFields: ['adoptionPet.name', 'application.applicationNo'],
  filterableFields: ['status'],
  rangeFields: range,
};

export const adminAdoptionQueryConfig: QueryBuilderConfig = {
  searchableFields: [
    'adoptionPet.name',
    'application.applicationNo',
    'user.email',
    'user.firstName',
  ],
  filterableFields: ['status', 'userId', 'adoptionPetId'],
  rangeFields: range,
};
