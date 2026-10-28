import { z } from 'zod';
import { emailSchema, nonEmpty, passwordSchema, phoneSchema } from '@/shared/utils/validation';
import { profileFields } from '@/modules/users/users.validation';

const tokenField = z.string().trim().min(10).max(200);

export const AuthValidation = {
  register: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: emailSchema,
    phone: phoneSchema.optional(),
    password: passwordSchema,
  }),

  login: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(64),
  }),

  token: z.object({ token: tokenField }),

  email: z.object({ email: emailSchema }),

  resetPassword: z.object({ token: tokenField, password: passwordSchema }),

  changePassword: z
    .object({
      currentPassword: z.string().min(1).max(64),
      newPassword: passwordSchema,
    })
    .refine((v) => v.currentPassword !== v.newPassword, {
      path: ['newPassword'],
      message: 'New password must be different from the current password',
    }),

  updateMe: nonEmpty(z.object(profileFields).strict()),
};

export type RegisterInput = z.infer<typeof AuthValidation.register>;
export type LoginInput = z.infer<typeof AuthValidation.login>;
export type UpdateMeInput = z.infer<typeof AuthValidation.updateMe>;
