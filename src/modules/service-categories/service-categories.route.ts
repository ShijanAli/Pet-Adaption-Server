import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idOrSlugParam, idParam } from '@/shared/utils/validation';
import { ServiceCategoryController } from './service-categories.controller';
import { CategoryValidation } from './service-categories.validation';

const r = createModuleRouter(
  '/service-categories',
  'Service Categories',
  'Grooming, Sitting, Training … (max 2 levels)',
);

r.get(
  '/',
  {
    summary: 'List categories',
    description: 'Public sees active only. Use `rootOnly=true` for top-level categories.',
    access: 'optional',
    query: CategoryValidation.listQuery,
  },
  ServiceCategoryController.getAll,
);

r.get(
  '/tree',
  { summary: 'Category tree (for menus)', access: 'optional' },
  ServiceCategoryController.getTree,
);

r.get(
  '/:idOrSlug',
  { summary: 'Get a category by id or slug', access: 'optional', params: idOrSlugParam },
  ServiceCategoryController.getOne,
);

r.post(
  '/',
  {
    summary: 'Create a category',
    access: { permissions: [P.SERVICE_CATEGORY.CREATE] },
    body: CategoryValidation.create,
  },
  ServiceCategoryController.create,
);

r.patch(
  '/:id',
  {
    summary: 'Update a category',
    access: { permissions: [P.SERVICE_CATEGORY.UPDATE] },
    params: idParam,
    body: CategoryValidation.update,
  },
  ServiceCategoryController.update,
);

r.delete(
  '/:id',
  {
    summary: 'Delete a category (soft delete)',
    description: 'Blocked while it still has sub-categories or services.',
    access: { permissions: [P.SERVICE_CATEGORY.DELETE] },
    params: idParam,
  },
  ServiceCategoryController.remove,
);

export const serviceCategoryRoutes = r;
