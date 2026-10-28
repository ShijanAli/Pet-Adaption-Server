import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idParam } from '@/shared/utils/validation';
import { TestimonialController } from './testimonials.controller';
import { TestimonialValidation } from './testimonials.validation';

const r = createModuleRouter(
  '/testimonials',
  'Testimonials',
  'Customer stories & adoption success stories',
);

r.get(
  '/',
  { summary: 'List testimonials', access: 'optional', query: TestimonialValidation.listQuery },
  TestimonialController.getAll,
);
r.get(
  '/:id',
  { summary: 'Get a testimonial', access: 'optional', params: idParam },
  TestimonialController.getById,
);
r.post(
  '/',
  {
    summary: 'Create a testimonial',
    access: { permissions: [P.TESTIMONIAL.CREATE] },
    body: TestimonialValidation.create,
  },
  TestimonialController.create,
);
r.patch(
  '/:id',
  {
    summary: 'Update a testimonial',
    access: { permissions: [P.TESTIMONIAL.UPDATE] },
    params: idParam,
    body: TestimonialValidation.update,
  },
  TestimonialController.update,
);
r.delete(
  '/:id',
  {
    summary: 'Delete a testimonial',
    access: { permissions: [P.TESTIMONIAL.DELETE] },
    params: idParam,
  },
  TestimonialController.remove,
);

export const testimonialRoutes = r;
