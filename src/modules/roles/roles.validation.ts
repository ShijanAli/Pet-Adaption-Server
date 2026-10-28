import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import {
  activeStatusSchema,
  booleanQuery,
  idArraySchema,
  nonEmpty,
} from '@/shared/utils/validation';
import { ROLE_SORTABLE_FIELDS } from './roles.constant';

const permissionIds = idArraySchema(500);

export const RoleValidation = {
  listQuery: listQuerySchema(ROLE_SORTABLE_FIELDS, {
    status: activeStatusSchema.optional(),
    isSystem: booleanQuery,
  }),

  create: z.object({
    name: z.string().trim().min(2).max(100),
    slug: z
      .string()
      .trim()
      .regex(
        /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/,
        'Slug may contain lowercase letters, numbers, - and _',
      )
      .max(100)
      .optional(),
    description: z.string().trim().max(500).optional(),
    status: activeStatusSchema.default('active'),
    permissionIds: permissionIds.default([]),
  }),

  update: nonEmpty(
    z
      .object({
        name: z.string().trim().min(2).max(100).optional(),
        description: z.string().trim().max(500).nullable().optional(),
        status: activeStatusSchema.optional(),
      })
      .strict(),
  ),

  assignPermissions: z.object({ permissionIds }),
};

export type ListRolesQuery = z.infer<typeof RoleValidation.listQuery>;
export type CreateRoleInput = z.infer<typeof RoleValidation.create>;
export type UpdateRoleInput = z.infer<typeof RoleValidation.update>;
