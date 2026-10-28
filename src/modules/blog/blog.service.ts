import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { assertIdsExist } from '@/shared/utils/db';
import { whereIdOrSlug } from '@/shared/utils/validation';
import {
  blogCategoryQueryConfig,
  postInclude,
  postQueryConfig,
  publicPostWhere,
  WORDS_PER_MINUTE,
} from './blog.constant';
import type {
  CategoryListQuery,
  CreatePostInput,
  PostListQuery,
  UpdatePostInput,
} from './blog.validation';

/* ───────────────────────── categories ───────────────────────── */

const categories = createCrudService({
  delegate: () => prisma.blogCategory,
  entityName: 'Blog category',
  slugFrom: 'name',
  queryConfig: blogCategoryQueryConfig,
});

export const BlogCategoryService = {
  getAll: (query: CategoryListQuery, canManage: boolean) =>
    categories.getAll(canManage ? query : { ...query, status: 'active' }),

  getByIdOrSlug: (idOrSlug: string, canManage: boolean) =>
    categories.getOne({ ...whereIdOrSlug(idOrSlug), ...(!canManage && { status: 'active' }) }),

  create: categories.create,
  update: categories.update,

  async remove(id: number) {
    await categories.getById(id);
    // soft-deleted posts still reference the category
    const posts = await prisma.blogPost.count({ where: { categoryId: id, deletedAt: undefined } });
    if (posts) throw AppError.conflict(`Category has ${posts} post(s). Move them first`);
    await prisma.blogCategory.delete({ where: { id } });
  },
};

/* ───────────────────────── posts ───────────────────────── */

// lists never ship the (large) content column
const posts = createCrudService({
  delegate: () => prisma.blogPost,
  entityName: 'Blog post',
  softDelete: true,
  queryConfig: postQueryConfig,
  include: postInclude,
  omit: { content: true },
});

const readingTime = (content: string) =>
  Math.max(
    1,
    Math.round(
      content
        .replace(/<[^>]+>/g, ' ')
        .split(/\s+/)
        .filter(Boolean).length / WORDS_PER_MINUTE,
    ),
  );

const assertCategory = (categoryId?: number) =>
  categoryId === undefined
    ? undefined
    : assertIdsExist(prisma.blogCategory, [categoryId], 'category');

export const BlogPostService = {
  getAll(query: PostListQuery, canManage: boolean) {
    return canManage
      ? posts.getAll(query)
      : posts.getAll({ ...query, status: undefined }, publicPostWhere());
  },

  async getByIdOrSlug(idOrSlug: string, canManage: boolean) {
    const post = await prisma.blogPost.findFirst({
      where: { ...whereIdOrSlug(idOrSlug), ...(!canManage && publicPostWhere()) },
      include: postInclude,
    });
    if (!post) throw AppError.notFound('Blog post');
    return { ...post, readingTimeMinutes: readingTime(post.content) };
  },

  async create(authorId: number, { slug, ...input }: CreatePostInput) {
    await assertCategory(input.categoryId);
    const created = await prisma.blogPost.create({
      data: {
        ...input,
        authorId,
        slug: await posts.ensureUniqueSlug(slug ?? input.title),
        publishedAt:
          input.status === 'published' ? (input.publishedAt ?? new Date()) : input.publishedAt,
      },
    });
    return BlogPostService.getByIdOrSlug(String(created.id), true);
  },

  async update(id: number, { slug, ...input }: UpdatePostInput) {
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Blog post');
    await assertCategory(input.categoryId);

    const publishingNow =
      input.status === 'published' && !existing.publishedAt && input.publishedAt === undefined;
    await prisma.blogPost.update({
      where: { id },
      data: {
        ...input,
        ...(slug && { slug: await posts.ensureUniqueSlug(slug, id) }),
        ...(publishingNow && { publishedAt: new Date() }),
      },
    });
    return BlogPostService.getByIdOrSlug(String(id), true);
  },

  remove: posts.remove,
};
