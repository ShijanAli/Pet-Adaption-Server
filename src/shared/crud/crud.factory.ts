import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import {
  buildListQuery,
  buildMeta,
  type BaseListQuery,
  type QueryBuilderConfig,
} from '@/shared/utils/queryBuilder';
import { sendResponse, type PaginationMeta } from '@/shared/utils/sendResponse';
import { slugify } from '@/shared/utils/common';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Minimal shape every Prisma model delegate satisfies */
export type ModelDelegate = {
  findMany(args?: any): Promise<any[]>;
  findFirst(args?: any): Promise<any>;
  count(args?: any): Promise<unknown>;
  create(args: any): Promise<any>;
  update(args: any): Promise<any>;
  delete(args: any): Promise<any>;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export type CrudOptions = {
  /** e.g. () => prisma.faq */
  delegate: () => ModelDelegate;
  /** Human name for messages: "FAQ", "Pet type" */
  entityName: string;
  /** Model has a deletedAt column */
  softDelete?: boolean;
  /** Auto-generate a unique `slug` from this field when not provided */
  slugFrom?: string;
  queryConfig?: QueryBuilderConfig;
  /** Prisma include for list + detail */
  include?: Record<string, unknown>;
  listInclude?: Record<string, unknown>;
  /** Prisma omit for list + detail (hide internal columns) */
  omit?: Record<string, boolean>;
};

/**
 * Generic CRUD service. Simple modules use it as-is,
 * complex modules spread it and override what they need.
 */
export const createCrudService = <TModel = unknown>(options: CrudOptions) => {
  const d = options.delegate;

  /** For soft-delete models, slug uniqueness must also consider deleted rows */
  const includeDeleted = options.softDelete ? { deletedAt: undefined } : {};

  const ensureUniqueSlug = async (source: string, excludeId?: number) => {
    const base = slugify(source) || 'item';
    let candidate = base;
    for (let i = 2; ; i++) {
      const existing = await d().findFirst({
        where: { slug: candidate, ...includeDeleted, ...(excludeId && { NOT: { id: excludeId } }) },
        select: { id: true },
      });
      if (!existing) return candidate;
      candidate = `${base}-${i}`;
    }
  };

  const service = {
    ensureUniqueSlug,

    async getAll(query: BaseListQuery, extraWhere: Record<string, unknown> = {}) {
      const q = buildListQuery(query, {
        ...options.queryConfig,
        baseWhere: { ...options.queryConfig?.baseWhere, ...extraWhere },
      });
      const [data, total] = (await prisma.$transaction([
        d().findMany({
          where: q.where,
          orderBy: q.orderBy,
          skip: q.skip,
          take: q.take,
          ...((options.listInclude ?? options.include) && {
            include: options.listInclude ?? options.include,
          }),
          ...(options.omit && { omit: options.omit }),
        }),
        d().count({ where: q.where }),
      ] as never)) as [TModel[], number];
      return { data, meta: buildMeta(total, q.page, q.limit) };
    },

    async getOne(where: Record<string, unknown>): Promise<TModel> {
      const item = await d().findFirst({
        where,
        ...(options.include && { include: options.include }),
      });
      if (!item) throw AppError.notFound(options.entityName);
      return item;
    },

    async getById(id: number): Promise<TModel> {
      return service.getOne({ id });
    },

    async create(data: Record<string, unknown>): Promise<TModel> {
      if (options.slugFrom && !data.slug && typeof data[options.slugFrom] === 'string') {
        data.slug = await ensureUniqueSlug(data[options.slugFrom] as string);
      } else if (options.slugFrom && typeof data.slug === 'string') {
        data.slug = await ensureUniqueSlug(data.slug);
      }
      return d().create({ data, ...(options.include && { include: options.include }) });
    },

    async update(id: number, data: Record<string, unknown>): Promise<TModel> {
      await service.getById!(id);
      if (options.slugFrom && typeof data.slug === 'string') {
        data.slug = await ensureUniqueSlug(data.slug, id);
      }
      return d().update({
        where: { id },
        data,
        ...(options.include && { include: options.include }),
      });
    },

    async remove(id: number): Promise<void> {
      await service.getById!(id);
      if (options.softDelete) {
        await d().update({ where: { id }, data: { deletedAt: new Date() } });
      } else {
        await d().delete({ where: { id } });
      }
    },
  };

  return service;
};

export type CrudService = ReturnType<typeof createCrudService>;

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Anything shaped like a CRUD service (factory output or a hand-written module service) */
export type CrudControllerService = {
  getAll(query: any): Promise<{ data: unknown; meta: unknown }>;
  getById(id: number): Promise<unknown>;
  create(data: any): Promise<unknown>;
  update(id: number, data: any): Promise<unknown>;
  remove(id: number): Promise<void>;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Generic controller — produces consistent messages for every CRUD module. */
export const createCrudController = (
  service: Partial<CrudControllerService>,
  names: { singular: string; plural: string },
) => ({
  getAll: async (req: Request, res: Response) => {
    const { data, meta } = await service.getAll!(req.query as unknown as BaseListQuery);
    sendResponse(res, {
      message: `${names.plural} retrieved successfully`,
      data,
      meta: meta as PaginationMeta,
    });
  },
  getById: async (req: Request, res: Response) => {
    const data = await service.getById!(Number(req.params.id));
    sendResponse(res, { message: `${names.singular} retrieved successfully`, data });
  },
  create: async (req: Request, res: Response) => {
    const data = await service.create!(req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: `${names.singular} created successfully`,
      data,
    });
  },
  update: async (req: Request, res: Response) => {
    const data = await service.update!(Number(req.params.id), req.body);
    sendResponse(res, { message: `${names.singular} updated successfully`, data });
  },
  remove: async (req: Request, res: Response) => {
    await service.remove!(Number(req.params.id));
    sendResponse(res, { message: `${names.singular} deleted successfully` });
  },
});
