import { z } from 'zod';
import type { PaginationMeta } from './sendResponse';

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

type SortOrder = 'asc' | 'desc';

/**
 * Builds the common list-query schema (page, limit, searchTerm, sortBy, sortOrder)
 * and merges module specific filters into it.
 *
 * @example
 * export const listServicesQuery = listQuerySchema(['createdAt', 'price', 'name'], {
 *   status: z.enum(['active', 'inactive']).optional(),
 *   minPrice: z.coerce.number().optional(),
 * });
 */
export const listQuerySchema = <
  const TSort extends readonly [string, ...string[]],
  TFilters extends z.ZodRawShape = Record<never, never>,
>(
  sortableFields: TSort,
  filters?: TFilters,
  defaults: { sortBy?: TSort[number]; sortOrder?: SortOrder } = {},
) =>
  z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
      searchTerm: z.string().trim().min(1).max(100).optional(),
      sortBy: z.enum(sortableFields).default(defaults.sortBy ?? sortableFields[0]),
      sortOrder: z.enum(['asc', 'desc']).default(defaults.sortOrder ?? 'desc'),
    })
    .extend((filters ?? {}) as TFilters);

export type BaseListQuery = {
  page: number;
  limit: number;
  searchTerm?: string;
  sortBy: string;
  sortOrder: SortOrder;
  [key: string]: unknown;
};

type RangeOperator = 'gte' | 'lte' | 'gt' | 'lt';

export type QueryBuilderConfig = {
  /** Fields searched with case-insensitive `contains`. Supports relation paths: "role.name" */
  searchableFields?: string[];
  /** Query keys copied 1:1 into `where` (query key → db field, supports paths) */
  filterableFields?: Record<string, string> | string[];
  /** Range filters: { minPrice: ['price', 'gte'], maxPrice: ['price', 'lte'] } */
  rangeFields?: Record<string, [field: string, operator: RangeOperator]>;
  /** Extra conditions always applied (e.g. ownership, published only) */
  baseWhere?: Record<string, unknown>;
};

/** "role.name" + value → { role: { name: value } } */
const setPath = (path: string, value: unknown): Record<string, unknown> =>
  path
    .split('.')
    .reverse()
    .reduce<unknown>((acc, key) => ({ [key]: acc }), value) as Record<string, unknown>;

const deepMerge = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> => {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      target[key] = deepMerge(
        { ...(existing as Record<string, unknown>) },
        value as Record<string, unknown>,
      );
    } else {
      target[key] = value;
    }
  }
  return target;
};

/**
 * Converts a validated list query into Prisma `findMany` args.
 * Only whitelisted fields can be searched / filtered / sorted (validated by Zod first).
 */
export const buildListQuery = <
  TWhere = Record<string, unknown>,
  TOrderBy = Record<string, unknown>,
>(
  query: BaseListQuery,
  config: QueryBuilderConfig = {},
) => {
  const { page, limit, searchTerm, sortBy, sortOrder } = query;
  const where: Record<string, unknown> = { ...(config.baseWhere ?? {}) };
  const AND: Record<string, unknown>[] = [];

  if (searchTerm && config.searchableFields?.length) {
    AND.push({
      OR: config.searchableFields.map((field) =>
        setPath(field, { contains: searchTerm, mode: 'insensitive' }),
      ),
    });
  }

  const filterMap = Array.isArray(config.filterableFields)
    ? Object.fromEntries(config.filterableFields.map((f) => [f, f]))
    : (config.filterableFields ?? {});

  for (const [queryKey, dbField] of Object.entries(filterMap)) {
    const value = query[queryKey];
    if (value !== undefined && value !== null && value !== '') {
      deepMerge(where, setPath(dbField, value));
    }
  }

  for (const [queryKey, [dbField, operator]] of Object.entries(config.rangeFields ?? {})) {
    const value = query[queryKey];
    if (value !== undefined && value !== null && value !== '') {
      deepMerge(where, setPath(dbField, { [operator]: value }));
    }
  }

  if (AND.length) where.AND = AND;

  return {
    where: where as TWhere,
    orderBy: setPath(sortBy, sortOrder) as TOrderBy,
    skip: (page - 1) * limit,
    take: limit,
    page,
    limit,
  };
};

export const buildMeta = (total: number, page: number, limit: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});
