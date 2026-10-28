import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { ReviewController } from './reviews.controller';
import { ReviewValidation } from './reviews.validation';

/* ───────── Public: reviews of a service ───────── */
const pub = createModuleRouter('/services', 'Reviews', 'Service reviews');

pub.get(
  '/:idOrSlug/reviews',
  {
    summary: 'Approved reviews of a service',
    description: 'Sort by `createdAt` or `rating`; filter by `rating`.',
    access: 'public',
    params: ReviewValidation.serviceParam,
    query: ReviewValidation.publicListQuery,
  },
  ReviewController.getForService,
);

pub.get(
  '/:idOrSlug/rating-summary',
  {
    summary: 'Average rating + 5★…1★ breakdown',
    access: 'public',
    params: ReviewValidation.serviceParam,
  },
  ReviewController.getSummary,
);

/* ───────── Customer + admin: /reviews ───────── */
const r = createModuleRouter('/reviews', 'Reviews', 'Service reviews');

r.post(
  '/',
  {
    summary: 'Review a completed booking',
    description:
      'One review per booking. New reviews are `pending` until a moderator approves them.',
    access: 'auth',
    body: ReviewValidation.create,
  },
  ReviewController.create,
);

r.get(
  '/',
  {
    summary: 'List all reviews (moderation queue)',
    access: { permissions: [P.REVIEW.VIEW] },
    query: ReviewValidation.adminListQuery,
  },
  ReviewController.getAll,
);

r.get(
  '/:id',
  { summary: 'Review detail', access: { permissions: [P.REVIEW.VIEW] }, params: idParam },
  ReviewController.getById,
);

r.patch(
  '/:id/status',
  {
    summary: 'Approve / reject a review',
    description: "Recalculates the service's average rating and review count.",
    access: { permissions: [P.REVIEW.MODERATE] },
    params: idParam,
    body: ReviewValidation.moderate,
  },
  ReviewController.moderate,
);

r.patch(
  '/:id/reply',
  {
    summary: 'Reply publicly to a review',
    access: { permissions: [P.REVIEW.MODERATE] },
    params: idParam,
    body: ReviewValidation.reply,
  },
  ReviewController.reply,
);

r.delete(
  '/:id',
  { summary: 'Delete any review', access: { permissions: [P.REVIEW.MODERATE] }, params: idParam },
  ReviewController.remove,
);

/* ───────── My reviews ───────── */
const me = createModuleRouter('/me/reviews', 'My Reviews', "The logged-in customer's reviews");

me.get(
  '/',
  { summary: 'List my reviews', access: 'auth', query: ReviewValidation.myListQuery },
  ReviewController.getMine,
);

me.patch(
  '/:id',
  {
    summary: 'Edit my review',
    description: 'Pending / rejected reviews only — the edit is sent for moderation again.',
    access: 'auth',
    params: idParam,
    body: ReviewValidation.update,
  },
  ReviewController.updateMine,
);

me.delete(
  '/:id',
  { summary: 'Delete my review', access: 'auth', params: idParam },
  ReviewController.removeMine,
);

export const publicReviewRoutes = pub;
export const reviewRoutes = r;
export const myReviewRoutes = me;
