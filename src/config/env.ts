import 'dotenv/config';
import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((s) =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  );

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().startsWith('/').default('/api/v1'),
  APP_NAME: z.string().default('Pet Adoption'),
  SERVER_URL: z.url(),
  CLIENT_URL: z.url(),
  CLIENT_URLS: csv,
  BUSINESS_TIMEZONE: z
    .string()
    .default('Asia/Dhaka')
    .refine((tz) => Intl.supportedValuesOf('timeZone').includes(tz), 'Invalid IANA timezone'),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  COOKIE_DOMAIN: optionalString,
  EMAIL_VERIFY_TOKEN_EXPIRES_MINUTES: z.coerce.number().int().positive().default(60),
  PASSWORD_RESET_TOKEN_EXPIRES_MINUTES: z.coerce.number().int().positive().default(30),

  BREVO_API_KEY: optionalString,
  EMAIL_FROM_NAME: z.string().default('Pet Adoption'),
  EMAIL_FROM_ADDRESS: z.email(),
  EMAIL_DRY_RUN: z.stringbool().default(false),

  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  CLOUDINARY_FOLDER: z.string().default('pet-adoption'),
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(5),

  SSLCOMMERZ_STORE_ID: optionalString,
  SSLCOMMERZ_STORE_PASSWORD: optionalString,
  SSLCOMMERZ_IS_LIVE: z.stringbool().default(false),

  JOBS_ENABLED: z.stringbool().default(true),

  SEED_SUPER_ADMIN_EMAIL: z.email().default('superadmin@petadoption.com'),
  SEED_SUPER_ADMIN_PASSWORD: z.string().min(8).default('SuperAdmin@123'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:\n', z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  isDevelopment: parsed.data.NODE_ENV === 'development',
};

export type Env = typeof env;
