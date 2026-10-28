import { describe, expect, it } from 'vitest';
import {
  API,
  api,
  bearer,
  createAndLogin,
  DEFAULT_PASSWORD,
  flushEmails,
  login,
  tokenFromEmail,
  uniqueEmail,
} from '../helpers';

const register = (email: string, password = DEFAULT_PASSWORD) =>
  api()
    .post(`${API}/auth/register`)
    .send({ firstName: 'Rahim', lastName: 'Uddin', email, password });

const registerAndVerify = async () => {
  const email = uniqueEmail('auth');
  await register(email).expect(201);
  await flushEmails();
  await api()
    .post(`${API}/auth/verify-email`)
    .send({ token: tokenFromEmail(email, 'EMAIL_VERIFY') })
    .expect(200);
  return email;
};

describe('Auth — registration & verification', () => {
  it('returns 422 with field errors in the common error format', async () => {
    const res = await api()
      .post(`${API}/auth/register`)
      .send({ email: 'not-an-email', password: 'weak' });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      success: false,
      statusCode: 422,
      message: 'Validation failed',
    });
    const paths = res.body.errors.map((e: { path: string }) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['firstName', 'email', 'password']));
  });

  it('registers a customer without leaking the password, rejects duplicates', async () => {
    const email = uniqueEmail('auth');
    const res = await register(email).expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      email,
      role: { slug: 'customer' },
      emailVerifiedAt: null,
    });
    expect(res.body.data.password).toBeUndefined();

    const dup = await register(email);
    expect(dup.status).toBe(409);
  });

  it('blocks login until the email is verified, token works only once', async () => {
    const email = uniqueEmail('auth');
    await register(email).expect(201);

    const before = await api()
      .post(`${API}/auth/login`)
      .send({ email, password: DEFAULT_PASSWORD });
    expect(before.status).toBe(403);

    await flushEmails();
    const token = tokenFromEmail(email, 'EMAIL_VERIFY');
    await api().post(`${API}/auth/verify-email`).send({ token }).expect(200);
    await api().post(`${API}/auth/verify-email`).send({ token }).expect(400);

    await login(email);
  });

  it('answers resend-verification the same way for unknown emails', async () => {
    const res = await api()
      .post(`${API}/auth/resend-verification`)
      .send({ email: 'nobody@nowhere.com' });
    expect(res.status).toBe(200);
  });
});

describe('Auth — login, me, tokens', () => {
  it('rejects wrong credentials with a generic message', async () => {
    const email = await registerAndVerify();
    const res = await api().post(`${API}/auth/login`).send({ email, password: 'Wrong@1234' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('logs in, sets an httpOnly refresh cookie and returns the profile with permissions', async () => {
    const email = await registerAndVerify();
    const res = await api().post(`${API}/auth/login`).send({ email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ email, permissions: [] });

    const cookie = ([] as string[]).concat(res.headers['set-cookie'])[0];
    expect(cookie).toMatch(/^refreshToken=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('protects /me', async () => {
    await api().get(`${API}/auth/me`).expect(401);
    await api().get(`${API}/auth/me`).set(bearer('garbage.token.value')).expect(401);

    const { accessToken } = await createAndLogin();
    const res = await api().get(`${API}/auth/me`).set(bearer(accessToken)).expect(200);
    expect(res.body.data.role.slug).toBe('customer');
  });

  it('updates my profile', async () => {
    const { accessToken } = await createAndLogin();
    const res = await api()
      .patch(`${API}/auth/me`)
      .set(bearer(accessToken))
      .send({ firstName: 'Karim', bio: 'Cat lover' })
      .expect(200);
    expect(res.body.data).toMatchObject({ firstName: 'Karim', bio: 'Cat lover' });

    await api().patch(`${API}/auth/me`).set(bearer(accessToken)).send({}).expect(422);
    // role / email can't be changed through /me
    await api().patch(`${API}/auth/me`).set(bearer(accessToken)).send({ roleId: 1 }).expect(422);
  });

  it('rotates the refresh token and detects reuse of an old one', async () => {
    const { cookie } = await createAndLogin();

    const first = await api().post(`${API}/auth/refresh-token`).set('Cookie', cookie).expect(200);
    expect(first.body.data.accessToken).toEqual(expect.any(String));
    const rotatedCookie = ([] as string[]).concat(first.headers['set-cookie'])[0];
    expect(rotatedCookie).not.toEqual(cookie);

    // re-using the old token → every session of the user is revoked
    await api().post(`${API}/auth/refresh-token`).set('Cookie', cookie).expect(401);
    await api().post(`${API}/auth/refresh-token`).set('Cookie', rotatedCookie).expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const { cookie } = await createAndLogin();
    await api().post(`${API}/auth/logout`).set('Cookie', cookie).expect(200);
    await api().post(`${API}/auth/refresh-token`).set('Cookie', cookie).expect(401);
    await api().post(`${API}/auth/refresh-token`).expect(401);
  });
});

describe('Auth — passwords', () => {
  it('resets the password with the emailed token', async () => {
    const email = await registerAndVerify();
    const { cookie } = await login(email);

    await api().post(`${API}/auth/forgot-password`).send({ email }).expect(200);
    await flushEmails();
    const token = tokenFromEmail(email, 'PASSWORD_RESET');

    await api()
      .post(`${API}/auth/reset-password`)
      .send({ token, password: 'NewPass@456' })
      .expect(200);

    // old sessions are revoked, old password no longer works
    await api().post(`${API}/auth/refresh-token`).set('Cookie', cookie).expect(401);
    await api().post(`${API}/auth/login`).send({ email, password: DEFAULT_PASSWORD }).expect(401);
    await login(email, 'NewPass@456');
  });

  it('changes the password only with the correct current password', async () => {
    const { accessToken, user } = await createAndLogin();

    const wrong = await api()
      .patch(`${API}/auth/change-password`)
      .set(bearer(accessToken))
      .send({ currentPassword: 'Nope@1234', newPassword: 'Another@123' });
    expect(wrong.status).toBe(400);

    const same = await api()
      .patch(`${API}/auth/change-password`)
      .set(bearer(accessToken))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: DEFAULT_PASSWORD });
    expect(same.status).toBe(422);

    await api()
      .patch(`${API}/auth/change-password`)
      .set(bearer(accessToken))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'Another@123' })
      .expect(200);
    await login(user.email, 'Another@123');
  });
});
