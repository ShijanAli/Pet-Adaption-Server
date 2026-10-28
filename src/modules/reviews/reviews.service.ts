import type { ReviewStatus } from '@generated/prisma/client';
import { prisma, type TransactionClient } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { notificationService } from '@/shared/services/notification.service';
import { buildListQuery, buildMeta } from '@/shared/utils/queryBuilder';
import { whereIdOrSlug } from '@/shared/utils/validation';
import {
  adminReviewInclude,
  adminReviewQueryConfig,
  myReviewInclude,
  myReviewQueryConfig,
  publicReviewQueryConfig,
  publicReviewSelect,
} from './reviews.constant';
import type { CreateReviewInput, ReviewListQuery, UpdateReviewInput } from './reviews.validation';

type Db = TransactionClient | typeof prisma;

const mine = createCrudService({
  delegate: () => prisma.review,
  entityName: 'Review',
  queryConfig: myReviewQueryConfig,
  include: myReviewInclude,
});

const all = createCrudService({
  delegate: () => prisma.review,
  entityName: 'Review',
  queryConfig: adminReviewQueryConfig,
  include: adminReviewInclude,
});

/** Keeps services.avg_rating / reviews_count in sync with APPROVED reviews */
const recalcRating = async (db: Db, serviceId: number) => {
  const agg = await db.review.aggregate({
    where: { serviceId, status: 'approved' },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await db.service.update({
    where: { id: serviceId },
    data: {
      avgRating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      reviewsCount: agg._count._all,
    },
  });
};

const imageRows = (urls: string[]) => urls.map((image, sortOrder) => ({ image, sortOrder }));

/** Public pages only show reviews of services the public can see */
const getVisibleService = async (idOrSlug: string) => {
  const service = await prisma.service.findFirst({
    where: { ...whereIdOrSlug(idOrSlug), status: 'active' },
    select: { id: true, avgRating: true, reviewsCount: true },
  });
  if (!service) throw AppError.notFound('Service');
  return service;
};

const getOwnReview = async (userId: number, id: number) => {
  const review = await prisma.review.findFirst({ where: { id, userId } });
  if (!review) throw AppError.notFound('Review');
  return review;
};

export const ReviewService = {
  /* ───── public ───── */

  async getForService(idOrSlug: string, query: ReviewListQuery) {
    const service = await getVisibleService(idOrSlug);
    const q = buildListQuery(query, {
      ...publicReviewQueryConfig,
      baseWhere: { serviceId: service.id, status: 'approved' },
    });
    const [data, total] = await Promise.all([
      prisma.review.findMany({
        where: q.where,
        orderBy: q.orderBy,
        skip: q.skip,
        take: q.take,
        select: publicReviewSelect,
      }),
      prisma.review.count({ where: q.where }),
    ]);
    return { data, meta: buildMeta(total, q.page, q.limit) };
  },

  /** Average, total and 1–5 star breakdown */
  async getSummary(idOrSlug: string) {
    const service = await getVisibleService(idOrSlug);
    const groups = await prisma.review.groupBy({
      by: ['rating'],
      where: { serviceId: service.id, status: 'approved' },
      _count: { _all: true },
    });
    const breakdown = Object.fromEntries([5, 4, 3, 2, 1].map((star) => [star, 0])) as Record<
      number,
      number
    >;
    for (const g of groups) breakdown[g.rating] = g._count._all;
    return {
      serviceId: service.id,
      averageRating: Number(service.avgRating),
      totalReviews: service.reviewsCount,
      breakdown,
    };
  },

  /* ───── customer ───── */

  async create(userId: number, { bookingId, images = [], ...input }: CreateReviewInput) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: { id: true, status: true, serviceId: true, review: { select: { id: true } } },
    });
    if (!booking) throw AppError.notFound('Booking');
    if (booking.status !== 'completed')
      throw AppError.badRequest('You can review a booking after it is completed');
    if (booking.review) throw AppError.conflict('You have already reviewed this booking');

    const review = await prisma.review.create({
      data: {
        ...input,
        bookingId,
        userId,
        serviceId: booking.serviceId,
        images: { create: imageRows(images) },
      },
    });
    return mine.getById(review.id);
  },

  getMine: (userId: number, query: ReviewListQuery) => mine.getAll(query, { userId }),

  /** Pending and rejected reviews can be edited — editing a rejected one re-submits it */
  async updateMine(userId: number, id: number, { images, ...input }: UpdateReviewInput) {
    const review = await getOwnReview(userId, id);
    if (review.status === 'approved') {
      throw AppError.badRequest('Approved reviews cannot be edited. Delete it and write a new one');
    }
    await prisma.review.update({
      where: { id },
      data: {
        ...input,
        status: 'pending',
        ...(images && { images: { deleteMany: {}, create: imageRows(images) } }),
      },
    });
    return mine.getById(id);
  },

  async removeMine(userId: number, id: number) {
    const review = await getOwnReview(userId, id);
    await ReviewService.removeById(review.id);
  },

  /* ───── admin ───── */

  getAll: (query: ReviewListQuery) => all.getAll(query),

  getById: (id: number) => all.getById(id),

  async moderate(id: number, status: Extract<ReviewStatus, 'approved' | 'rejected'>) {
    const review = await prisma.review.findUnique({
      where: { id },
      include: { service: { select: { name: true } } },
    });
    if (!review) throw AppError.notFound('Review');
    if (review.status === status) return all.getById(id);

    await prisma.$transaction(async (tx) => {
      await tx.review.update({ where: { id }, data: { status } });
      await recalcRating(tx, review.serviceId);
    });
    notificationService.notify(review.userId, {
      type: `review.${status}`,
      title: status === 'approved' ? 'Your review is live' : 'Your review was not published',
      message: `Your review of ${review.service.name} was ${status}`,
      data: { reviewId: id },
    });
    return all.getById(id);
  },

  async reply(id: number, reply: string | null) {
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw AppError.notFound('Review');
    await prisma.review.update({
      where: { id },
      data: { adminReply: reply, repliedAt: reply ? new Date() : null },
    });
    if (reply) {
      notificationService.notify(review.userId, {
        type: 'review.replied',
        title: 'We replied to your review',
        message: reply.slice(0, 140),
        data: { reviewId: id },
      });
    }
    return all.getById(id);
  },

  async removeById(id: number) {
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw AppError.notFound('Review');
    await prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });
      if (review.status === 'approved') await recalcRating(tx, review.serviceId);
    });
  },
};
