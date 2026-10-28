/**
 * Single source of truth for every permission slug.
 * - Routes use `PERMISSIONS.X.Y` with `authorize()`
 * - The seeder turns this object into rows in the `permissions` table
 *
 * Format: `<module>.<action>`
 */
export const PERMISSIONS = {
  ROLE: {
    VIEW: 'role.view',
    CREATE: 'role.create',
    UPDATE: 'role.update',
    DELETE: 'role.delete',
    ASSIGN_PERMISSION: 'role.assign_permission',
  },
  PERMISSION: {
    VIEW: 'permission.view',
  },
  USER: {
    VIEW: 'user.view',
    CREATE: 'user.create',
    UPDATE: 'user.update',
    DELETE: 'user.delete',
  },
  UPLOAD: {
    DELETE: 'upload.delete',
  },
  PET_TYPE: {
    CREATE: 'pet_type.create',
    UPDATE: 'pet_type.update',
    DELETE: 'pet_type.delete',
  },
  PET: {
    VIEW: 'pet.view',
  },
  SERVICE_CATEGORY: {
    CREATE: 'service_category.create',
    UPDATE: 'service_category.update',
    DELETE: 'service_category.delete',
  },
  SERVICE: {
    CREATE: 'service.create',
    UPDATE: 'service.update',
    DELETE: 'service.delete',
  },
  STAFF_SCHEDULE: {
    VIEW: 'staff_schedule.view',
    MANAGE: 'staff_schedule.manage',
  },
  BLOCKED_DATE: {
    VIEW: 'blocked_date.view',
    MANAGE: 'blocked_date.manage',
  },
  BOOKING: {
    VIEW: 'booking.view',
    UPDATE_STATUS: 'booking.update_status',
    ASSIGN_STAFF: 'booking.assign_staff',
  },
  PROMOTION: {
    VIEW: 'promotion.view',
    CREATE: 'promotion.create',
    UPDATE: 'promotion.update',
    DELETE: 'promotion.delete',
  },
  PAYMENT: {
    VIEW: 'payment.view',
    CREATE: 'payment.create',
    REFUND: 'payment.refund',
  },
  REVIEW: {
    VIEW: 'review.view',
    MODERATE: 'review.moderate',
  },
  ADOPTION_PET: {
    CREATE: 'adoption_pet.create',
    UPDATE: 'adoption_pet.update',
    DELETE: 'adoption_pet.delete',
  },
  ADOPTION_APPLICATION: {
    VIEW: 'adoption_application.view',
    REVIEW: 'adoption_application.review',
  },
  ADOPTION: {
    VIEW: 'adoption.view',
    UPDATE: 'adoption.update',
  },
  GALLERY: {
    CREATE: 'gallery.create',
    UPDATE: 'gallery.update',
    DELETE: 'gallery.delete',
  },
  BLOG: {
    VIEW: 'blog.view',
    CREATE: 'blog.create',
    UPDATE: 'blog.update',
    DELETE: 'blog.delete',
  },
  TESTIMONIAL: {
    CREATE: 'testimonial.create',
    UPDATE: 'testimonial.update',
    DELETE: 'testimonial.delete',
  },
  FAQ: {
    CREATE: 'faq.create',
    UPDATE: 'faq.update',
    DELETE: 'faq.delete',
  },
  CONTACT: {
    VIEW: 'contact.view',
    UPDATE: 'contact.update',
  },
  NEWSLETTER: {
    VIEW: 'newsletter.view',
  },
  SETTING: {
    VIEW: 'setting.view',
    UPDATE: 'setting.update',
  },
  ACTIVITY_LOG: {
    VIEW: 'activity_log.view',
  },
  DASHBOARD: {
    VIEW: 'dashboard.view',
  },
} as const;

type ValueOf<T> = T[keyof T];
export type PermissionSlug = ValueOf<{
  [K in keyof typeof PERMISSIONS]: ValueOf<(typeof PERMISSIONS)[K]>;
}>;

const toTitle = (value: string) =>
  value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** Flat list used by the seeder: [{ slug, module, name }] */
export const PERMISSION_DEFINITIONS = Object.values(PERMISSIONS).flatMap((group) =>
  Object.values(group).map((slug) => {
    const [module, action] = (slug as string).split('.');
    return { slug: slug as PermissionSlug, module, name: `${toTitle(action)} ${toTitle(module)}` };
  }),
);

export const ALL_PERMISSION_SLUGS = PERMISSION_DEFINITIONS.map((p) => p.slug);
