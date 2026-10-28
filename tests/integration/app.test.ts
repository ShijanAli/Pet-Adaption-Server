import { describe, expect, it } from 'vitest';
import { api } from '../helpers';

describe('App', () => {
  it('health check', async () => {
    const res = await api().get('/health').expect(200);
    expect(res.body).toMatchObject({ success: true, statusCode: 200 });
  });

  it('unknown routes use the common error format', async () => {
    const res = await api().get('/api/v1/does-not-exist').expect(404);
    expect(res.body).toEqual({
      success: false,
      statusCode: 404,
      message: 'Route not found: GET /api/v1/does-not-exist',
    });
  });

  it('malformed JSON returns 400', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Malformed JSON body');
  });

  it('serves the OpenAPI document', async () => {
    const res = await api().get('/docs.json').expect(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/auth/login'].post).toBeDefined();
    expect(res.body.paths['/roles/{id}'].get.security).toEqual([{ bearerAuth: [] }]);
  });
});
