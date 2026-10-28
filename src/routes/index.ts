import { Router } from 'express';
import type { ModuleRouter } from '@/shared/http/createModuleRouter';
import { authRoutes } from '@/modules/auth/auth.route';
import { roleRoutes } from '@/modules/roles/roles.route';
import { permissionRoutes } from '@/modules/permissions/permissions.route';
import { userRoutes } from '@/modules/users/users.route';
import { uploadRoutes } from '@/modules/uploads/uploads.route';
import { petTypeRoutes } from '@/modules/pet-types/pet-types.route';
import { adminPetRoutes, myPetRoutes } from '@/modules/pets/pets.route';
import { serviceCategoryRoutes } from '@/modules/service-categories/service-categories.route';
import { serviceRoutes } from '@/modules/services/services.route';
import { availabilityRoutes } from '@/modules/availability/availability.route';
import { staffRoutes } from '@/modules/staff/staff.route';
import { blockedDateRoutes } from '@/modules/blocked-dates/blocked-dates.route';
import { promotionRoutes } from '@/modules/promotions/promotions.route';
import {
  bookingRoutes,
  myBookingRoutes,
  staffBookingRoutes,
} from '@/modules/bookings/bookings.route';
import { myPaymentRoutes, paymentRoutes } from '@/modules/payments/payments.route';
import { adoptionPetRoutes } from '@/modules/adoption-pets/adoption-pets.route';
import { favoriteRoutes } from '@/modules/favorites/favorites.route';
import {
  applicationRoutes,
  myApplicationRoutes,
} from '@/modules/adoption-applications/adoption-applications.route';
import { adoptionRoutes, myAdoptionRoutes } from '@/modules/adoptions/adoptions.route';
import { myReviewRoutes, publicReviewRoutes, reviewRoutes } from '@/modules/reviews/reviews.route';
import { galleryAlbumRoutes, galleryItemRoutes } from '@/modules/gallery/gallery.route';
import { blogCategoryRoutes, blogPostRoutes } from '@/modules/blog/blog.route';
import { faqRoutes } from '@/modules/faqs/faqs.route';
import { testimonialRoutes } from '@/modules/testimonials/testimonials.route';
import { contactRoutes } from '@/modules/contact/contact.route';
import { newsletterRoutes } from '@/modules/newsletter/newsletter.route';
import { settingRoutes } from '@/modules/settings/settings.route';
import { notificationRoutes } from '@/modules/notifications/notifications.route';
import { activityLogRoutes } from '@/modules/activity-logs/activity-logs.route';
import { dashboardRoutes } from '@/modules/dashboard/dashboard.route';

/** Register every module router here — order only matters for overlapping paths. */
const moduleRoutes: ModuleRouter[] = [
  authRoutes,
  roleRoutes,
  permissionRoutes,
  userRoutes,
  uploadRoutes,
  // Phase 2
  petTypeRoutes,
  myPetRoutes,
  adminPetRoutes,
  serviceCategoryRoutes,
  availabilityRoutes,
  serviceRoutes,
  staffRoutes,
  blockedDateRoutes,
  // Phase 3
  promotionRoutes,
  bookingRoutes,
  myBookingRoutes,
  staffBookingRoutes,
  paymentRoutes,
  myPaymentRoutes,
  // Phase 4
  adoptionPetRoutes,
  favoriteRoutes,
  applicationRoutes,
  myApplicationRoutes,
  adoptionRoutes,
  myAdoptionRoutes,
  // Phase 5
  publicReviewRoutes,
  reviewRoutes,
  myReviewRoutes,
  galleryAlbumRoutes,
  galleryItemRoutes,
  // Phase 6
  blogCategoryRoutes,
  blogPostRoutes,
  faqRoutes,
  testimonialRoutes,
  contactRoutes,
  newsletterRoutes,
  settingRoutes,
  notificationRoutes,
  activityLogRoutes,
  dashboardRoutes,
];

export const apiRouter = Router();

for (const m of moduleRoutes) {
  apiRouter.use(m.basePath, m.router);
}
