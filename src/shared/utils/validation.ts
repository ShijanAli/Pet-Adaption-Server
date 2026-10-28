import { z } from 'zod';

/** Reusable zod building blocks */
export const idParam = z.object({ id: z.coerce.number().int().positive() });
export type IdParam = z.infer<typeof idParam>;

export const slugParam = z.object({ slug: z.string().trim().min(1).max(200) });

/** `/services/12` and `/services/dog-grooming` both work */
export const idOrSlugParam = z.object({ idOrSlug: z.string().trim().min(1).max(200) });

export const whereIdOrSlug = (value: string) => whereIdOr('slug', value);

/** Numeric → `{ id }`, otherwise `{ [field]: value }` (slug, bookingNo, applicationNo …) */
export const whereIdOr = (field: string, value: string) =>
  /^\d+$/.test(value) ? { id: Number(value) } : { [field]: value };

/** Optional slug provided by admins (auto-generated from the name when omitted) */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, numbers and hyphens')
  .max(170);

/** Money in the base currency: positive, max 2 decimals */
export const moneySchema = z
  .number()
  .nonnegative()
  .max(99_999_999)
  .refine((v) => Number.isInteger(Number((v * 100).toFixed(6))), {
    message: 'Amount can have at most 2 decimal places',
  });

/** Array of unique positive ids */
export const idArraySchema = (max = 100) =>
  z
    .array(z.number().int().positive())
    .max(max)
    .transform((ids) => [...new Set(ids)]);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(64)
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const emailSchema = z.email().trim().toLowerCase().max(150);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,20}$/, 'Invalid phone number');

/** Accepts "true"/"false" in query strings */
export const booleanQuery = z.stringbool().optional();

export const activeStatusSchema = z.enum(['active', 'inactive']);

export const urlSchema = z.url().max(255);

/** Requires at least one key in PATCH bodies */
export const nonEmpty = <T extends z.ZodObject>(schema: T) =>
  schema.refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });
