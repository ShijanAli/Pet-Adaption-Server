import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '@/app';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { emailOutbox } from '@/shared/services/email.service';
import type { EmailTemplateName } from '@/emails/templates';

export const app = createApp();
export const API = env.API_PREFIX;
export const api = () => request(app);

export const DEFAULT_PASSWORD = 'Password@123';

let counter = 0;
export const uniqueEmail = (prefix = 'user') =>
  `${prefix}.${Date.now()}.${++counter}@test.com`.toLowerCase();

/** Creates a verified user with the given role directly in the DB */
export const createUser = async (
  roleSlug = 'customer',
  overrides: Partial<{
    email: string;
    password: string;
    status: 'active' | 'inactive' | 'blocked';
  }> = {},
) => {
  const role = await prisma.role.findUniqueOrThrow({ where: { slug: roleSlug } });
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const user = await prisma.user.create({
    data: {
      firstName: 'Test',
      lastName: roleSlug,
      email: overrides.email ?? uniqueEmail(roleSlug),
      password: await bcrypt.hash(password, 4),
      roleId: role.id,
      status: overrides.status ?? 'active',
      emailVerifiedAt: new Date(),
    },
  });
  return { ...user, password };
};

/** Logs in and returns the access token + raw refresh cookie */
export const login = async (email: string, password = DEFAULT_PASSWORD) => {
  const res = await api().post(`${API}/auth/login`).send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return {
    accessToken: res.body.data.accessToken as string,
    cookie: cookies.find((c) => c.startsWith('refreshToken=')) ?? '',
    user: res.body.data.user,
  };
};

export const loginAsSuperAdmin = () =>
  login(env.SEED_SUPER_ADMIN_EMAIL, env.SEED_SUPER_ADMIN_PASSWORD);

/** Creates a user with the role and logs in */
export const createAndLogin = async (roleSlug = 'customer') => {
  const user = await createUser(roleSlug);
  const { accessToken, cookie } = await login(user.email, user.password);
  return { user, accessToken, cookie };
};

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Reads the token from the last dry-run email of a template sent to `email` */
export const tokenFromEmail = (email: string, template: EmailTemplateName) => {
  const mail = [...emailOutbox]
    .reverse()
    .find((m) => m.to.email === email && m.template === template);
  const token = mail?.html.match(/token=([a-f0-9]+)/)?.[1];
  if (!token) throw new Error(`No ${template} email with token found for ${email}`);
  return token;
};

/** Waits for fire-and-forget emails to land in the outbox */
export const flushEmails = () => new Promise((r) => setTimeout(r, 20));

/** POST /bookings as the given session */
export const bookViaApi = (
  accessToken: string,
  body: {
    serviceId: number;
    petId: number;
    date: string;
    startTime: string;
    [key: string]: unknown;
  },
) => api().post(`${API}/bookings`).set(bearer(accessToken)).send(body);
