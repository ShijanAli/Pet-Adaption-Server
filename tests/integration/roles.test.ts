import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { API, api, bearer, createAndLogin, createUser, login, loginAsSuperAdmin } from '../helpers';

let adminToken: string;

const permissionId = async (slug: string) =>
  (await prisma.permission.findUniqueOrThrow({ where: { slug } })).id;

beforeAll(async () => {
  adminToken = (await loginAsSuperAdmin()).accessToken;
});

describe('Roles & permissions (RBAC)', () => {
  it('forbids users without the permission', async () => {
    const { accessToken } = await createAndLogin('customer');
    const res = await api().get(`${API}/roles`).set(bearer(accessToken));
    expect(res.status).toBe(403);
    expect(res.body.message).toContain(PERMISSIONS.ROLE.VIEW);
  });

  it('lists roles with pagination meta', async () => {
    const res = await api()
      .get(`${API}/roles?limit=2&sortBy=name&sortOrder=asc`)
      .set(bearer(adminToken))
      .expect(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2 });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(4);
    expect(res.body.data[0]._count).toBeDefined();
  });

  it('lists permissions grouped by module', async () => {
    const res = await api()
      .get(`${API}/permissions?grouped=true`)
      .set(bearer(adminToken))
      .expect(200);
    const roleGroup = res.body.data.find((g: { module: string }) => g.module === 'role');
    expect(roleGroup.permissions.length).toBe(5);
  });

  it('creates a custom role whose permissions are enforced immediately', async () => {
    const viewUsers = await permissionId(PERMISSIONS.USER.VIEW);

    const created = await api()
      .post(`${API}/roles`)
      .set(bearer(adminToken))
      .send({ name: 'Support Agent', permissionIds: [viewUsers, viewUsers] })
      .expect(201);

    expect(created.body.data).toMatchObject({ slug: 'support-agent', isSystem: false });
    expect(created.body.data.permissions.map((p: { slug: string }) => p.slug)).toEqual([
      PERMISSIONS.USER.VIEW,
    ]);

    const roleId = created.body.data.id;
    const agent = await createUser('support-agent');
    const { accessToken } = await login(agent.email, agent.password);

    await api().get(`${API}/users`).set(bearer(accessToken)).expect(200);
    await api().get(`${API}/roles`).set(bearer(accessToken)).expect(403);

    // grant role.view → works without re-login (cache invalidated)
    await api()
      .put(`${API}/roles/${roleId}/permissions`)
      .set(bearer(adminToken))
      .send({ permissionIds: [viewUsers, await permissionId(PERMISSIONS.ROLE.VIEW)] })
      .expect(200);
    await api().get(`${API}/roles`).set(bearer(accessToken)).expect(200);

    // deactivating the role locks its users out
    await api()
      .patch(`${API}/roles/${roleId}`)
      .set(bearer(adminToken))
      .send({ status: 'inactive' })
      .expect(200);
    await api().get(`${API}/auth/me`).set(bearer(accessToken)).expect(403);

    // a role with users cannot be deleted
    await api().delete(`${API}/roles/${roleId}`).set(bearer(adminToken)).expect(409);
  });

  it('rejects unknown permission ids', async () => {
    await api()
      .post(`${API}/roles`)
      .set(bearer(adminToken))
      .send({ name: 'Ghost', permissionIds: [999999] })
      .expect(400);
  });

  it('protects system roles', async () => {
    const superAdmin = await prisma.role.findUniqueOrThrow({ where: { slug: 'super_admin' } });
    const customer = await prisma.role.findUniqueOrThrow({ where: { slug: 'customer' } });

    await api().delete(`${API}/roles/${customer.id}`).set(bearer(adminToken)).expect(403);
    await api()
      .put(`${API}/roles/${superAdmin.id}/permissions`)
      .set(bearer(adminToken))
      .send({ permissionIds: [] })
      .expect(403);
    await api()
      .patch(`${API}/roles/${superAdmin.id}`)
      .set(bearer(adminToken))
      .send({ status: 'inactive' })
      .expect(403);
  });

  it('deletes an unused custom role', async () => {
    const created = await api()
      .post(`${API}/roles`)
      .set(bearer(adminToken))
      .send({ name: 'Temporary' })
      .expect(201);
    await api().delete(`${API}/roles/${created.body.data.id}`).set(bearer(adminToken)).expect(200);
    await api().get(`${API}/roles/${created.body.data.id}`).set(bearer(adminToken)).expect(404);
  });
});
