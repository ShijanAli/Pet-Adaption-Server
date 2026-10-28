import { rateLimit } from 'express-rate-limit';
import { env } from '@/config/env';

const createLimiter = (limit: number, message: string, windowMinutes = 15) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.isTest,
    message: { success: false, statusCode: 429, message },
  });

/** Applied to the whole API */
export const globalLimiter = createLimiter(500, 'Too many requests, please try again later');

/** Login, password reset, verification … (brute-forceable endpoints) */
export const authLimiter = createLimiter(
  10,
  'Too many attempts, please try again after 15 minutes',
);

/** Public forms: contact, newsletter … */
export const formLimiter = createLimiter(5, 'Too many submissions, please try again later', 60);
