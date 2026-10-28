import type { CookieOptions } from 'express';
import { env } from '@/config/env';

export const REFRESH_COOKIE_NAME = 'refreshToken';

/**
 * Frontend and backend live on different domains, so in production the cookie must be
 * `SameSite=None; Secure`. Locally (localhost:3000 ↔ localhost:5000 are same-site) `Lax` works.
 * The cookie is scoped to the auth routes, so it is not sent with every API call.
 */
export const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax',
  domain: env.COOKIE_DOMAIN,
  path: `${env.API_PREFIX}/auth`,
  maxAge: env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
});

export const clearRefreshCookieOptions = (): CookieOptions => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { maxAge, ...rest } = refreshCookieOptions();
  return rest;
};
