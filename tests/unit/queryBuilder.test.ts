import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildListQuery, buildMeta, listQuerySchema } from '@/shared/utils/queryBuilder';

describe('listQuerySchema', () => {
  const schema = listQuerySchema(['createdAt', 'price'] as const, {
    status: z.enum(['active', 'inactive']).optional(),
    minPrice: z.coerce.number().optional(),
  });

  it('applies defaults and coerces query strings', () => {
    const q = schema.parse({ page: '2', limit: '5', minPrice: '100' });
    expect(q).toMatchObject({
      page: 2,
      limit: 5,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      minPrice: 100,
    });
  });

  it('rejects non-whitelisted sort fields and too large limits', () => {
    expect(schema.safeParse({ sortBy: 'password' }).success).toBe(false);
    expect(schema.safeParse({ limit: '1000' }).success).toBe(false);
    expect(schema.safeParse({ page: '0' }).success).toBe(false);
  });
});

describe('buildListQuery', () => {
  it('builds pagination, search, filters, ranges and nested sort', () => {
    const q = buildListQuery(
      {
        page: 3,
        limit: 10,
        searchTerm: 'groom',
        sortBy: 'category.name',
        sortOrder: 'asc',
        status: 'active',
        role: 'staff',
        minPrice: 100,
        maxPrice: 500,
      },
      {
        searchableFields: ['name', 'category.name'],
        filterableFields: { status: 'status', role: 'role.slug' },
        rangeFields: { minPrice: ['price', 'gte'], maxPrice: ['price', 'lte'] },
        baseWhere: { deletedAt: null },
      },
    );

    expect(q.skip).toBe(20);
    expect(q.take).toBe(10);
    expect(q.orderBy).toEqual({ category: { name: 'asc' } });
    expect(q.where).toEqual({
      deletedAt: null,
      status: 'active',
      role: { slug: 'staff' },
      price: { gte: 100, lte: 500 },
      AND: [
        {
          OR: [
            { name: { contains: 'groom', mode: 'insensitive' } },
            { category: { name: { contains: 'groom', mode: 'insensitive' } } },
          ],
        },
      ],
    });
  });

  it('ignores empty filters', () => {
    const q = buildListQuery(
      { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc', status: undefined },
      { filterableFields: ['status'] },
    );
    expect(q.where).toEqual({});
  });
});

describe('buildMeta', () => {
  it('calculates total pages', () => {
    expect(buildMeta(57, 2, 10)).toEqual({ page: 2, limit: 10, total: 57, totalPages: 6 });
    expect(buildMeta(0, 1, 10).totalPages).toBe(1);
  });
});
