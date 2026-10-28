import { beforeAll, describe, expect, it } from 'vitest';
import { API, api, bearer, loginAsSuperAdmin } from '../helpers';
import { createService } from '../helpers/fixtures';

let admin: string;

const create = (body: Record<string, unknown>) =>
  api().post(`${API}/service-categories`).set(bearer(admin)).send(body);

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
});

describe('Service categories', () => {
  it('supports max two levels', async () => {
    const parent = (await create({ name: `Grooming ${Date.now()}` }).expect(201)).body.data;
    const child = (await create({ name: `Bath ${Date.now()}`, parentId: parent.id }).expect(201))
      .body.data;

    expect(child.parent).toMatchObject({ id: parent.id });
    await create({ name: 'Too deep', parentId: child.id }).expect(400);
    // a category with children cannot itself become a child
    const other = (await create({ name: `Other ${Date.now()}` }).expect(201)).body.data;
    await api()
      .patch(`${API}/service-categories/${parent.id}`)
      .set(bearer(admin))
      .send({ parentId: other.id })
      .expect(400);
    await api()
      .patch(`${API}/service-categories/${parent.id}`)
      .set(bearer(admin))
      .send({ parentId: parent.id })
      .expect(400);
  });

  it('builds a public tree without inactive categories', async () => {
    const parent = (await create({ name: `Training ${Date.now()}` }).expect(201)).body.data;
    const active = (await create({ name: `Basic ${Date.now()}`, parentId: parent.id }).expect(201))
      .body.data;
    const hidden = (
      await create({
        name: `Hidden ${Date.now()}`,
        parentId: parent.id,
        status: 'inactive',
      }).expect(201)
    ).body.data;

    const tree = await api().get(`${API}/service-categories/tree`).expect(200);
    const node = tree.body.data.find((c: { id: number }) => c.id === parent.id);
    const childIds = node.children.map((c: { id: number }) => c.id);
    expect(childIds).toContain(active.id);
    expect(childIds).not.toContain(hidden.id);

    await api().get(`${API}/service-categories/${hidden.slug}`).expect(404);
    await api().get(`${API}/service-categories/${hidden.slug}`).set(bearer(admin)).expect(200);

    const roots = await api().get(`${API}/service-categories?rootOnly=true&limit=100`).expect(200);
    expect(roots.body.data.every((c: { parentId: number | null }) => c.parentId === null)).toBe(
      true,
    );
  });

  it('blocks deleting a category that still has services', async () => {
    const category = (await create({ name: `Sitting ${Date.now()}` }).expect(201)).body.data;
    const service = await createService({ categoryId: category.id });

    await api().delete(`${API}/service-categories/${category.id}`).set(bearer(admin)).expect(409);

    await api().delete(`${API}/services/${service.id}`).set(bearer(admin)).expect(200);
    await api().delete(`${API}/service-categories/${category.id}`).set(bearer(admin)).expect(200);
    await api().get(`${API}/service-categories/${category.id}`).set(bearer(admin)).expect(404);
  });
});
