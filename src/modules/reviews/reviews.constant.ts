import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export const REVIEW_SORTABLE_FIELDS = ['createdAt', 'rating'] as const;

export const MAX_REVIEW_IMAGES = 5;

const images = { orderBy: { sortOrder: 'asc' as const }, select: { id: true, image: true } };

/** Public: reviewer first name + photo only */
export const publicReviewSelect = {
  id: true,
  rating: true,
  title: true,
  comment: true,
  adminReply: true,
  repliedAt: true,
  createdAt: true,
  user: { select: { firstName: true, profilePhoto: true } },
  images,
} as const;

export const myReviewInclude = {
  service: { select: { id: true, name: true, slug: true } },
  booking: { select: { id: true, bookingNo: true, bookingDate: true } },
  images,
} as const;

export const adminReviewInclude = {
  ...myReviewInclude,
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

export const publicReviewQueryConfig: QueryBuilderConfig = {
  filterableFields: ['rating'],
};

export const myReviewQueryConfig: QueryBuilderConfig = {
  searchableFields: ['title', 'comment', 'service.name'],
  filterableFields: ['status', 'rating', 'serviceId'],
};

export const adminReviewQueryConfig: QueryBuilderConfig = {
  searchableFields: ['title', 'comment', 'service.name', 'user.email', 'booking.bookingNo'],
  filterableFields: ['status', 'rating', 'serviceId', 'userId'],
};
