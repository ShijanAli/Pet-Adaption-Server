import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idOrSlugParam, idParam } from '@/shared/utils/validation';
import { BlogCategoryController, BlogPostController } from './blog.controller';
import { BlogValidation } from './blog.validation';

/* ───────── Categories ───────── */
const categories = createModuleRouter('/blog/categories', 'Blog', 'Pet care articles');

categories.get(
  '/',
  { summary: 'List blog categories', access: 'optional', query: BlogValidation.categoryListQuery },
  BlogCategoryController.getAll,
);
categories.get(
  '/:idOrSlug',
  { summary: 'Get a blog category', access: 'optional', params: idOrSlugParam },
  BlogCategoryController.getOne,
);
categories.post(
  '/',
  {
    summary: 'Create a blog category',
    access: { permissions: [P.BLOG.CREATE] },
    body: BlogValidation.createCategory,
  },
  BlogCategoryController.create,
);
categories.patch(
  '/:id',
  {
    summary: 'Update a blog category',
    access: { permissions: [P.BLOG.UPDATE] },
    params: idParam,
    body: BlogValidation.updateCategory,
  },
  BlogCategoryController.update,
);
categories.delete(
  '/:id',
  {
    summary: 'Delete a blog category',
    description: 'Only when it has no posts.',
    access: { permissions: [P.BLOG.DELETE] },
    params: idParam,
  },
  BlogCategoryController.remove,
);

/* ───────── Posts ───────── */
const posts = createModuleRouter('/blog/posts', 'Blog', 'Pet care articles');

posts.get(
  '/',
  {
    summary: 'List blog posts (without content)',
    description:
      'Public: published posts whose `publishedAt` has passed, in active categories. ' +
      'With `blog.view` drafts and scheduled posts are included.',
    access: 'optional',
    query: BlogValidation.postListQuery,
  },
  BlogPostController.getAll,
);
posts.get(
  '/:idOrSlug',
  {
    summary: 'Read a post (with content + reading time)',
    access: 'optional',
    params: idOrSlugParam,
  },
  BlogPostController.getOne,
);
posts.post(
  '/',
  {
    summary: 'Create a post',
    description:
      '`status: published` without `publishedAt` publishes now; a future `publishedAt` schedules it.',
    access: { permissions: [P.BLOG.CREATE] },
    body: BlogValidation.createPost,
  },
  BlogPostController.create,
);
posts.patch(
  '/:id',
  {
    summary: 'Update a post',
    access: { permissions: [P.BLOG.UPDATE] },
    params: idParam,
    body: BlogValidation.updatePost,
  },
  BlogPostController.update,
);
posts.delete(
  '/:id',
  {
    summary: 'Delete a post (soft delete)',
    access: { permissions: [P.BLOG.DELETE] },
    params: idParam,
  },
  BlogPostController.remove,
);

export const blogCategoryRoutes = categories;
export const blogPostRoutes = posts;
