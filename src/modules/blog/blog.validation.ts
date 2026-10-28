import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { activeStatusSchema, nonEmpty, slugSchema, urlSchema } from '@/shared/utils/validation';
import { CATEGORY_SORTABLE_FIELDS, POST_SORTABLE_FIELDS } from './blog.constant';

const categoryFields = {
  name: z.string().trim().min(2).max(100),
  slug: slugSchema.max(120).optional(),
  status: activeStatusSchema,
};

const postFields = {
  categoryId: z.number().int().positive(),
  title: z.string().trim().min(3).max(200),
  slug: slugSchema.max(220).optional(),
  excerpt: z.string().trim().max(300).nullable().optional(),
  content: z.string().trim().min(20).max(100_000).describe('HTML or Markdown from the editor'),
  coverImage: urlSchema.nullable().optional(),
  status: z.enum(['draft', 'published']),
  publishedAt: z.coerce
    .date()
    .nullable()
    .optional()
    .describe('Future date = scheduled. Defaults to now when publishing'),
  metaTitle: z.string().trim().max(200).nullable().optional(),
  metaDescription: z.string().trim().max(300).nullable().optional(),
};

export const BlogValidation = {
  categoryListQuery: listQuerySchema(
    CATEGORY_SORTABLE_FIELDS,
    { status: activeStatusSchema.optional().describe('Admins only') },
    { sortBy: 'name', sortOrder: 'asc' },
  ),
  createCategory: z.object({ ...categoryFields, status: categoryFields.status.default('active') }),
  updateCategory: nonEmpty(z.object(categoryFields).partial().strict()),

  postListQuery: listQuerySchema(
    POST_SORTABLE_FIELDS,
    {
      category: z.string().trim().optional().describe('Category slug'),
      categoryId: z.coerce.number().int().positive().optional(),
      authorId: z.coerce.number().int().positive().optional(),
      status: z.enum(['draft', 'published']).optional().describe('Admins only'),
    },
    { sortBy: 'publishedAt', sortOrder: 'desc' },
  ),
  createPost: z.object({ ...postFields, status: postFields.status.default('draft') }),
  updatePost: nonEmpty(z.object(postFields).partial().strict()),
};

export type PostListQuery = z.infer<typeof BlogValidation.postListQuery>;
export type CategoryListQuery = z.infer<typeof BlogValidation.categoryListQuery>;
export type CreatePostInput = z.infer<typeof BlogValidation.createPost>;
export type UpdatePostInput = z.infer<typeof BlogValidation.updatePost>;
