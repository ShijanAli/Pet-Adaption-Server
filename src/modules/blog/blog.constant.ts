import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export const POST_SORTABLE_FIELDS = ['publishedAt', 'createdAt', 'title'] as const;
export const CATEGORY_SORTABLE_FIELDS = ['name', 'createdAt'] as const;

export const WORDS_PER_MINUTE = 200;

/** A post is public when published, its publish time has come and its category is active */
export const publicPostWhere = () => ({
  status: 'published' as const,
  publishedAt: { lte: new Date() },
  category: { status: 'active' as const },
});

export const postQueryConfig: QueryBuilderConfig = {
  searchableFields: ['title', 'excerpt', 'category.name'],
  filterableFields: {
    category: 'category.slug',
    categoryId: 'categoryId',
    authorId: 'authorId',
    status: 'status',
  },
};

export const blogCategoryQueryConfig: QueryBuilderConfig = {
  searchableFields: ['name', 'slug'],
  filterableFields: ['status'],
};

export const postInclude = {
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
} as const;
