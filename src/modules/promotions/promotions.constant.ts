import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export const PROMOTION_SORTABLE_FIELDS = [
  'createdAt',
  'startsAt',
  'endsAt',
  'title',
  'usedCount',
] as const;

export const promotionQueryConfig: QueryBuilderConfig = {
  searchableFields: ['title', 'code', 'description'],
  filterableFields: ['status', 'discountType', 'appliesTo'],
};

export const promotionInclude = {
  services: { select: { service: { select: { id: true, name: true, slug: true } } } },
  categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
  _count: { select: { usages: true } },
} as const;

/** Fields safe to show on the public site */
export const publicPromotionSelect = {
  id: true,
  title: true,
  code: true,
  description: true,
  discountType: true,
  discountValue: true,
  maxDiscountAmount: true,
  minOrderAmount: true,
  appliesTo: true,
  bannerImage: true,
  startsAt: true,
  endsAt: true,
} as const;
