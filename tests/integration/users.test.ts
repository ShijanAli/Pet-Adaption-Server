import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { emailOutbox } from '@/shared/services/email.service';
import {
  API,
  api,
  bearer,
  createAndLogin,
  createUser,
  flushEmails,
  loginAsSuperAdmin,
  uniqueEmail,
} from '../helpers';

let adminToken: string;
let adminId: number;

beforeAll(async () => {
  const session = await loginAsSuperAdmin();
  adminToken = session.accessToken;
  adminId = session.user.id;
});

describe('Users (admin)', () => {
  it('supports search, filter, sort and pagination', async () => {
    const tag = `zeta${Date.now()}`;
    await createUser('staff', { email: `${tag}.a@test.com` });
    await createUser('staff', { email: `${tag}.b@test.com` });
    await createUser('customer', { email: `${tag}.c@test.com` });

    const res = await api()
      .get(`${API}/users`)
      .query({
        searchTerm: tag,
        role: 'staff',
        sortBy: 'email',
        sortOrder: 'asc',
        limit: 1,
        page: 2,
      })
      .set(bearer(adminToken))
      .expect(200);

    expect(res.body.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
    expect(res.body.data[0].email).toBe(`${tag}.b@test.com`);
    expect(res.body.data[0].password).toBeUndefined();
  });

  it('validates list query params', async () => {
    const res = await api().get(`${API}/users?sortBy=password`).set(bearer(adminToken));
    expect(res.status).toBe(422);
    expect(res.body.errors[0].path).toBe('sortBy');
  });

  it('creates a staff account without a password and emails the user', async () => {
    const staffRole = await prisma.role.findUniqueOrThrow({ where: { slug: 'staff' } });
    const email = uniqueEmail('newstaff');

    const res = await api()
      .post(`${API}/users`)
      .set(bearer(adminToken))
      .send({ firstName: 'Nadia', lastName: 'Groomer', email, roleId: staffRole.id })
      .expect(201);

    expect(res.body.data).toMatchObject({ email, role: { slug: 'staff' } });
    expect(res.body.data.emailVerifiedAt).not.toBeNull();
    await flushEmails();
    expect(emailOutbox.some((m) => m.to.email === email && m.template === 'ACCOUNT_CREATED')).toBe(
      true,
    );
  });

  it('only a super admin can hand out the super admin role', async () => {
    const { accessToken } = await createAndLogin('admin');
    const superRole = await prisma.role.findUniqueOrThrow({ where: { slug: 'super_admin' } });
    const target = await createUser('customer');

    await api()
      .patch(`${API}/users/${target.id}/role`)
      .set(bearer(accessToken))
      .send({ roleId: superRole.id })
      .expect(403);
  });

  it('blocking a user locks them out instantly', async () => {
    const { user, accessToken, cookie } = await createAndLogin('customer');

    await api()
      .patch(`${API}/users/${user.id}/status`)
      .set(bearer(adminToken))
      .send({ status: 'blocked' })
      .expect(200);

    await api().get(`${API}/auth/me`).set(bearer(accessToken)).expect(403);
    await api().post(`${API}/auth/refresh-token`).set('Cookie', cookie).expect(401);
  });

  it('prevents actions on your own account', async () => {
    await api()
      .patch(`${API}/users/${adminId}/status`)
      .set(bearer(adminToken))
      .send({ status: 'blocked' })
      .expect(403);
    await api().delete(`${API}/users/${adminId}`).set(bearer(adminToken)).expect(403);
  });

  it('soft deletes a user and frees the email for a new registration', async () => {
    const target = await createUser('customer');

    await api().delete(`${API}/users/${target.id}`).set(bearer(adminToken)).expect(200);
    await api().get(`${API}/users/${target.id}`).set(bearer(adminToken)).expect(404);

    const stillInDb = await prisma.user.findFirst({
      where: { id: target.id, deletedAt: { not: null } },
    });
    expect(stillInDb).not.toBeNull();

    await api()
      .post(`${API}/auth/register`)
      .send({ firstName: 'Again', lastName: 'User', email: target.email, password: 'Password@123' })
      .expect(201);
  });
});
