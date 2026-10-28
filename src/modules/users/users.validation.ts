import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import {
  booleanQuery,
  emailSchema,
  nonEmpty,
  passwordSchema,
  phoneSchema,
  urlSchema,
} from '@/shared/utils/validation';
import { USER_SORTABLE_FIELDS } from './users.constant';

const userStatus = z.enum(['active', 'inactive', 'blocked']);

const nameSchema = z.string().trim().min(1).max(100);

/** Profile fields shared by "update me" and admin "update user" */
export const profileFields = {
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phone: phoneSchema.nullable().optional(),
  address: z.string().trim().max(255).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  profilePhoto: urlSchema.nullable().optional(),
};

export const UserValidation = {
  listQuery: listQuerySchema(USER_SORTABLE_FIELDS, {
    roleId: z.coerce.number().int().positive().optional(),
    role: z.string().trim().optional().describe('Role slug, e.g. staff'),
    status: userStatus.optional(),
    isVerified: booleanQuery,
  }),

  create: z.object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    phone: phoneSchema.optional(),
    // when omitted, a random password is set and the user is asked to use "forgot password"
    password: passwordSchema.optional(),
    roleId: z.number().int().positive(),
    status: userStatus.default('active'),
  }),

  update: nonEmpty(z.object(profileFields).strict()),

  updateStatus: z.object({ status: userStatus }),

  updateRole: z.object({ roleId: z.number().int().positive() }),
};

export type ListUsersQuery = z.infer<typeof UserValidation.listQuery>;
export type CreateUserInput = z.infer<typeof UserValidation.create>;
export type UpdateUserInput = z.infer<typeof UserValidation.update>;
