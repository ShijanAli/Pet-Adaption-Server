import { beforeAll, describe, expect, it } from 'vitest';
import { API, api, bearer, createAndLogin, loginAsSuperAdmin } from '../helpers';
import { createService } from '../helpers/fixtures';

let admin: string;
const url = (n: number | string) => `https://res.cloudinary.com/demo/image/upload/gallery/${n}.jpg`;

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
});

const createAlbum = (body: Record<string, unknown>) =>
  api().post(`${API}/gallery/albums`).set(bearer(admin)).send(body);

const createItem = (body: Record<string, unknown>) =>
  api().post(`${API}/gallery/items`).set(bearer(admin)).send(body);

describe('Gallery albums', () => {
  it('creates albums with slugs, cover fallback and item counts', async () => {
    const album = (await createAlbum({ title: `Happy Tails ${Date.now()}` }).expect(201)).body.data;
    expect(album.slug).toMatch(/^happy-tails/);

    await api()
      .post(`${API}/gallery/items/bulk`)
      .set(bearer(admin))
      .send({
        albumId: album.id,
        items: [{ fileUrl: url(1) }, { fileUrl: url(2) }, { fileUrl: url(3) }],
      })
      .expect(201);

    const res = await api().get(`${API}/gallery/albums/${album.slug}`).expect(200);
    expect(res.body.data).toMatchObject({ itemCount: 3, cover: url(1) });

    const hidden = (
      await createAlbum({ title: `Hidden ${Date.now()}`, status: 'inactive' }).expect(201)
    ).body.data;
    await api().get(`${API}/gallery/albums/${hidden.id}`).expect(404);
    await api().get(`${API}/gallery/albums/${hidden.id}`).set(bearer(admin)).expect(200);

    const list = await api().get(`${API}/gallery/albums?limit=100`).expect(200);
    const ids = list.body.data.map((a: { id: number }) => a.id);
    expect(ids).toContain(album.id);
    expect(ids).not.toContain(hidden.id);
  });

  it('customers cannot manage the gallery', async () => {
    const { accessToken } = await createAndLogin();
    await api()
      .post(`${API}/gallery/albums`)
      .set(bearer(accessToken))
      .send({ title: 'Nope' })
      .expect(403);
  });
});

describe('Gallery items', () => {
  it('filters by album / service / media type and hides inactive content from the public', async () => {
    const album = (await createAlbum({ title: `Grooming ${Date.now()}` }).expect(201)).body.data;
    const service = await createService();

    await createItem({
      albumId: album.id,
      serviceId: service.id,
      fileUrl: url('after'),
      beforeImageUrl: url('before'),
      altText: 'Poodle before and after grooming',
      isFeatured: true,
    }).expect(201);
    await createItem({
      albumId: album.id,
      mediaType: 'video',
      fileUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: url('thumb'),
    }).expect(201);
    await createItem({ albumId: album.id, fileUrl: url('draft'), status: 'inactive' }).expect(201);

    const q = (params: Record<string, unknown>) =>
      api().get(`${API}/gallery/items`).query(params).expect(200);
    expect((await q({ album: album.slug })).body.meta.total).toBe(2);
    expect((await q({ album: album.slug, mediaType: 'video' })).body.meta.total).toBe(1);
    const byService = await q({ serviceId: service.id });
    expect(byService.body.data[0]).toMatchObject({
      beforeImageUrl: url('before'),
      service: { id: service.id },
    });

    const adm = await api()
      .get(`${API}/gallery/items`)
      .query({ album: album.slug })
      .set(bearer(admin))
      .expect(200);
    expect(adm.body.meta.total).toBe(3);

    // items of an inactive album disappear from the public gallery
    await api()
      .patch(`${API}/gallery/albums/${album.id}`)
      .set(bearer(admin))
      .send({ status: 'inactive' })
      .expect(200);
    expect((await q({ albumId: album.id })).body.meta.total).toBe(0);
  });

  it('validates media rules and targets', async () => {
    await createItem({ mediaType: 'video', fileUrl: url(1), beforeImageUrl: url(2) }).expect(422);
    await createItem({ fileUrl: 'not a url' }).expect(422);
    await createItem({ fileUrl: url(1), albumId: 999999 }).expect(400);
  });

  it('reorders items', async () => {
    const album = (await createAlbum({ title: `Order ${Date.now()}` }).expect(201)).body.data;
    await api()
      .post(`${API}/gallery/items/bulk`)
      .set(bearer(admin))
      .send({ albumId: album.id, items: [{ fileUrl: url('a') }, { fileUrl: url('b') }] })
      .expect(201);
    const before = (await api().get(`${API}/gallery/items?albumId=${album.id}`).expect(200)).body
      .data;
    expect(before.map((i: { fileUrl: string }) => i.fileUrl)).toEqual([url('a'), url('b')]);

    await api()
      .patch(`${API}/gallery/items/reorder`)
      .set(bearer(admin))
      .send({
        items: [
          { id: before[0].id, sortOrder: 5 },
          { id: before[1].id, sortOrder: 1 },
        ],
      })
      .expect(200);

    const after = (await api().get(`${API}/gallery/items?albumId=${album.id}`).expect(200)).body
      .data;
    expect(after.map((i: { fileUrl: string }) => i.fileUrl)).toEqual([url('b'), url('a')]);

    await api()
      .patch(`${API}/gallery/items/reorder`)
      .set(bearer(admin))
      .send({ items: [{ id: 999999, sortOrder: 1 }] })
      .expect(400);
  });

  it('deleting an album keeps its items', async () => {
    const album = (await createAlbum({ title: `Temp ${Date.now()}` }).expect(201)).body.data;
    const item = (await createItem({ albumId: album.id, fileUrl: url('keep') }).expect(201)).body
      .data;

    await api().delete(`${API}/gallery/albums/${album.id}`).set(bearer(admin)).expect(200);
    const res = await api().get(`${API}/gallery/items/${item.id}`).expect(200);
    expect(res.body.data.albumId).toBeNull();
  });
});
