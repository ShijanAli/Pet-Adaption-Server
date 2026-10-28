import { beforeAll, describe, expect, it, vi } from 'vitest';

// Cloudinary is mocked — tests never hit the network
vi.mock('@/lib/cloudinary', () => ({
  uploadBuffer: vi.fn(async (_buffer: Buffer, folder: string) => ({
    url: `https://res.cloudinary.com/demo/image/upload/${folder}/fake.png`,
    publicId: `pet-adoption/${folder}/fake`,
    width: 1,
    height: 1,
    format: 'png',
    bytes: 68,
  })),
  deleteByPublicId: vi.fn(async () => true),
}));

const { API, api, bearer, createAndLogin } = await import('../helpers');

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

let token: string;

beforeAll(async () => {
  token = (await createAndLogin('customer')).accessToken;
});

describe('Uploads', () => {
  it('requires login', async () => {
    await api().post(`${API}/uploads/image`).attach('file', PNG, 'a.png').expect(401);
  });

  it('uploads a single image into the requested folder', async () => {
    const res = await api()
      .post(`${API}/uploads/image?folder=pets`)
      .set(bearer(token))
      .attach('file', PNG, { filename: 'dog.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body.data.url).toContain('/pets/');
  });

  it('uploads multiple images', async () => {
    const res = await api()
      .post(`${API}/uploads/images`)
      .set(bearer(token))
      .attach('files', PNG, { filename: '1.png', contentType: 'image/png' })
      .attach('files', PNG, { filename: '2.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body.data).toHaveLength(2);
  });

  it('rejects missing files, wrong types and unknown folders', async () => {
    await api().post(`${API}/uploads/image`).set(bearer(token)).expect(400);
    await api()
      .post(`${API}/uploads/image`)
      .set(bearer(token))
      .attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' })
      .expect(400);
    await api()
      .post(`${API}/uploads/image?folder=../../etc`)
      .set(bearer(token))
      .attach('file', PNG, { filename: 'dog.png', contentType: 'image/png' })
      .expect(422);
  });

  it('only users with upload.delete can delete files', async () => {
    await api()
      .delete(`${API}/uploads`)
      .set(bearer(token))
      .send({ publicId: 'pet-adoption/pets/fake' })
      .expect(403);
  });
});
