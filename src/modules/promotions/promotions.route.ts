import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { idParam } from '@/shared/utils/validation';
import { PromotionController } from './promotions.controller';
import { PromotionValidation } from './promotions.validation';

const r = createModuleRouter('/promotions', 'Promotions', 'Promo codes / coupons for services');

r.get(
  '/active',
  { summary: 'Promotions running now (public banners)', access: 'public' },
  PromotionController.getActive,
);

r.post(
  '/validate',
  {
    summary: 'Check a promo code for a service (checkout preview)',
    description: 'Returns the discount and the final price, or 400 with the reason.',
    access: 'auth',
    body: PromotionValidation.validateCode,
    successStatus: 200,
  },
  PromotionController.validate,
);

r.get(
  '/',
  {
    summary: 'List promotions',
    access: { permissions: [P.PROMOTION.VIEW] },
    query: PromotionValidation.listQuery,
  },
  PromotionController.getAll,
);

r.post(
  '/',
  {
    summary: 'Create a promotion',
    description: '`discountValue` is a % for `percentage`, an amount in BDT for `fixed`.',
    access: { permissions: [P.PROMOTION.CREATE] },
    body: PromotionValidation.create,
  },
  PromotionController.create,
);

r.get(
  '/:id',
  { summary: 'Get a promotion', access: { permissions: [P.PROMOTION.VIEW] }, params: idParam },
  PromotionController.getById,
);

r.get(
  '/:id/usages',
  {
    summary: 'Who used a promotion',
    access: { permissions: [P.PROMOTION.VIEW] },
    params: idParam,
    query: listQuerySchema(['createdAt'] as const),
  },
  PromotionController.getUsages,
);

r.patch(
  '/:id',
  {
    summary: 'Update a promotion',
    description: 'Sending `serviceIds` / `categoryIds` replaces the current list.',
    access: { permissions: [P.PROMOTION.UPDATE] },
    params: idParam,
    body: PromotionValidation.update,
  },
  PromotionController.update,
);

r.delete(
  '/:id',
  {
    summary: 'Delete a promotion',
    description: 'Only unused promotions can be deleted — deactivate used ones.',
    access: { permissions: [P.PROMOTION.DELETE] },
    params: idParam,
  },
  PromotionController.remove,
);

export const promotionRoutes = r;
