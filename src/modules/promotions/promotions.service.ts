import type { Promotion } from '@generated/prisma/client';
import { prisma, type TransactionClient } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { assertIdsExist } from '@/shared/utils/db';
import { round2, toNumber } from '@/shared/utils/money';
import type { BaseListQuery } from '@/shared/utils/queryBuilder';
import { buildListQuery, buildMeta } from '@/shared/utils/queryBuilder';
import {
  promotionInclude,
  promotionQueryConfig,
  publicPromotionSelect,
} from './promotions.constant';
import type {
  CreatePromotionInput,
  ListPromotionsQuery,
  UpdatePromotionInput,
} from './promotions.validation';

type Db = TransactionClient | typeof prisma;

const crud = createCrudService({
  delegate: () => prisma.promotion,
  entityName: 'Promotion',
  queryConfig: promotionQueryConfig,
  include: promotionInclude,
});

type WithJoins = {
  services?: { service: unknown }[];
  categories?: { category: unknown }[];
};

const toDto = <T extends WithJoins>(p: T) => ({
  ...p,
  ...(p.services && { services: p.services.map((s) => s.service) }),
  ...(p.categories && { categories: p.categories.map((c) => c.category) }),
});

const runningNowWhere = () => {
  const now = new Date();
  return { status: 'active' as const, startsAt: { lte: now }, endsAt: { gte: now } };
};

const assertTargets = async (serviceIds?: number[], categoryIds?: number[]) => {
  await Promise.all([
    serviceIds ? assertIdsExist(prisma.service, serviceIds, 'service') : undefined,
    categoryIds ? assertIdsExist(prisma.serviceCategory, categoryIds, 'category') : undefined,
  ]);
};

const assertCodeFree = async (code: string, excludeId?: number) => {
  const existing = await prisma.promotion.findUnique({ where: { code }, select: { id: true } });
  if (existing && existing.id !== excludeId) throw AppError.conflict('Promo code already exists');
};

/** Discount for an amount, capped by max discount and by the amount itself */
export const calculateDiscount = (promotion: Promotion, amount: number) => {
  const value = toNumber(promotion.discountValue);
  let discount = promotion.discountType === 'percentage' ? (amount * value) / 100 : value;
  if (promotion.maxDiscountAmount != null)
    discount = Math.min(discount, toNumber(promotion.maxDiscountAmount));
  return round2(Math.min(discount, amount));
};

export type PromotionTarget = { id: number; categoryId: number; price: number };

export const PromotionService = {
  async getAll({ runningNow, ...query }: ListPromotionsQuery) {
    const { data, meta } = await crud.getAll(
      query as BaseListQuery,
      runningNow ? runningNowWhere() : {},
    );
    return { data: (data as WithJoins[]).map(toDto), meta };
  },

  async getById(id: number) {
    return toDto((await crud.getById(id)) as WithJoins);
  },

  /** Banners / offers for the public site */
  getActive: () =>
    prisma.promotion.findMany({
      where: runningNowWhere(),
      select: publicPromotionSelect,
      orderBy: { endsAt: 'asc' },
    }),

  async create(actorId: number, { serviceIds, categoryIds, ...input }: CreatePromotionInput) {
    await assertCodeFree(input.code);
    await assertTargets(serviceIds, categoryIds);
    const created = await prisma.promotion.create({
      data: {
        ...input,
        createdById: actorId,
        services: { create: serviceIds.map((serviceId) => ({ serviceId })) },
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      },
    });
    return PromotionService.getById(created.id);
  },

  async update(id: number, { serviceIds, categoryIds, ...input }: UpdatePromotionInput) {
    const existing = await prisma.promotion.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Promotion');

    // validate the combination that will actually be stored
    const type = input.discountType ?? existing.discountType;
    const value = input.discountValue ?? toNumber(existing.discountValue);
    if (type === 'percentage' && value > 100) {
      throw AppError.unprocessable('Percentage cannot exceed 100', [
        { path: 'discountValue', message: 'Max 100' },
      ]);
    }
    if ((input.endsAt ?? existing.endsAt) <= (input.startsAt ?? existing.startsAt)) {
      throw AppError.unprocessable('End date must be after the start date', [
        { path: 'endsAt', message: 'Must be after startsAt' },
      ]);
    }
    if (input.code) await assertCodeFree(input.code, id);
    await assertTargets(serviceIds, categoryIds);

    await prisma.promotion.update({
      where: { id },
      data: {
        ...input,
        ...(serviceIds && {
          services: { deleteMany: {}, create: serviceIds.map((serviceId) => ({ serviceId })) },
        }),
        ...(categoryIds && {
          categories: { deleteMany: {}, create: categoryIds.map((categoryId) => ({ categoryId })) },
        }),
      },
    });
    return PromotionService.getById(id);
  },

  async remove(id: number) {
    await crud.getById(id);
    const used = await prisma.promotionUsage.count({ where: { promotionId: id } });
    if (used > 0) {
      throw AppError.conflict('This promotion has already been used. Deactivate it instead');
    }
    await prisma.promotion.delete({ where: { id } });
  },

  async getUsages(id: number, query: BaseListQuery) {
    await crud.getById(id);
    const q = buildListQuery(query, {
      searchableFields: ['user.email', 'booking.bookingNo'],
      baseWhere: { promotionId: id },
    });
    const [data, total] = await prisma.$transaction([
      prisma.promotionUsage.findMany({
        where: q.where,
        orderBy: q.orderBy,
        skip: q.skip,
        take: q.take,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          booking: { select: { id: true, bookingNo: true, status: true } },
        },
      }),
      prisma.promotionUsage.count({ where: q.where }),
    ]);
    return { data, meta: buildMeta(total, q.page, q.limit) };
  },

  /**
   * Checks every rule of a promo code for a user + service and returns the discount.
   * Throws 400 with a human readable reason when the code cannot be used.
   */
  async evaluate(db: Db, code: string, userId: number, target: PromotionTarget) {
    const promotion = await db.promotion.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        services: { select: { serviceId: true } },
        categories: { select: { categoryId: true } },
      },
    });
    const invalid = (reason: string) =>
      AppError.badRequest(reason, [{ path: 'promoCode', message: reason }]);

    const now = new Date();
    if (!promotion || promotion.status !== 'active') throw invalid('Invalid promo code');
    if (promotion.startsAt > now) throw invalid('This promo code is not active yet');
    if (promotion.endsAt < now) throw invalid('This promo code has expired');
    if (promotion.usageLimit != null && promotion.usedCount >= promotion.usageLimit) {
      throw invalid('This promo code has reached its usage limit');
    }

    const usedByUser = await db.promotionUsage.count({
      where: { promotionId: promotion.id, userId },
    });
    if (usedByUser >= promotion.perUserLimit)
      throw invalid('You have already used this promo code');

    if (promotion.minOrderAmount != null && target.price < toNumber(promotion.minOrderAmount)) {
      throw invalid(`Minimum order amount for this code is ${toNumber(promotion.minOrderAmount)}`);
    }

    if (promotion.appliesTo === 'specific_services') {
      if (!promotion.services.some((s) => s.serviceId === target.id)) {
        throw invalid('This promo code is not valid for this service');
      }
    }
    if (promotion.appliesTo === 'specific_categories') {
      const category = await db.serviceCategory.findUnique({
        where: { id: target.categoryId },
        select: { id: true, parentId: true },
      });
      const ids = promotion.categories.map((c) => c.categoryId);
      // a parent category promotion also covers its sub-categories
      if (
        !category ||
        !(ids.includes(category.id) || (category.parentId && ids.includes(category.parentId)))
      ) {
        throw invalid('This promo code is not valid for this service');
      }
    }

    return { promotion, discountAmount: calculateDiscount(promotion, target.price) };
  },

  /** Atomically consumes one use (fails if the global limit was reached concurrently) */
  async reserve(
    tx: TransactionClient,
    promotionId: number,
    usage: { userId: number; bookingId: number; discountAmount: number },
  ) {
    const updated = await tx.$executeRaw`
      UPDATE promotions SET used_count = used_count + 1
      WHERE id = ${promotionId} AND (usage_limit IS NULL OR used_count < usage_limit)`;
    if (updated === 0) throw AppError.conflict('This promo code has just reached its usage limit');
    await tx.promotionUsage.create({ data: { promotionId, ...usage } });
  },

  /** Gives the use back (booking cancelled before it happened) */
  async release(tx: TransactionClient, bookingId: number) {
    const usages = await tx.promotionUsage.findMany({ where: { bookingId } });
    for (const usage of usages) {
      await tx.promotionUsage.delete({ where: { id: usage.id } });
      await tx.$executeRaw`
        UPDATE promotions SET used_count = GREATEST(used_count - 1, 0) WHERE id = ${usage.promotionId}`;
    }
  },

  /** Checkout preview: POST /promotions/validate */
  async preview(userId: number, code: string, serviceId: number) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, status: 'active' },
      select: { id: true, name: true, categoryId: true, price: true, discountPrice: true },
    });
    if (!service) throw AppError.notFound('Service');

    const price = toNumber(service.discountPrice ?? service.price);
    const { promotion, discountAmount } = await PromotionService.evaluate(prisma, code, userId, {
      id: service.id,
      categoryId: service.categoryId,
      price,
    });
    return {
      code: promotion.code,
      title: promotion.title,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      servicePrice: price,
      discountAmount,
      totalAmount: round2(price - discountAmount),
    };
  },
};
