import { ALL_PERMISSION_SLUGS, PERMISSIONS, type PermissionSlug } from './permissions';

/** System roles created by the seeder. They cannot be deleted. */
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  STAFF: 'staff',
  CUSTOMER: 'customer',
} as const;

export type SystemRoleSlug = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

const ADMIN_EXCLUDED: PermissionSlug[] = [
  PERMISSIONS.ROLE.CREATE,
  PERMISSIONS.ROLE.UPDATE,
  PERMISSIONS.ROLE.DELETE,
  PERMISSIONS.ROLE.ASSIGN_PERMISSION,
];

/** Default permissions per system role (super_admin bypasses checks anyway). */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleSlug, PermissionSlug[]> = {
  super_admin: ALL_PERMISSION_SLUGS,
  admin: ALL_PERMISSION_SLUGS.filter((p) => !ADMIN_EXCLUDED.includes(p)),
  staff: [
    PERMISSIONS.PET.VIEW,
    PERMISSIONS.BOOKING.VIEW,
    PERMISSIONS.BOOKING.UPDATE_STATUS,
    PERMISSIONS.STAFF_SCHEDULE.VIEW,
    PERMISSIONS.BLOCKED_DATE.VIEW,
    PERMISSIONS.REVIEW.VIEW,
  ],
  customer: [],
};

export const SYSTEM_ROLE_DEFINITIONS: {
  slug: SystemRoleSlug;
  name: string;
  description: string;
}[] = [
  { slug: 'super_admin', name: 'Super Admin', description: 'Full access to everything' },
  { slug: 'admin', name: 'Admin', description: 'Manages the platform except roles' },
  { slug: 'staff', name: 'Staff', description: 'Groomers, sitters, trainers' },
  { slug: 'customer', name: 'Customer', description: 'Registered site users' },
];
