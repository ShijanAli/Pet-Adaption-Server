import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { authLimiter } from '@/shared/middlewares/rateLimiter';
import { AuthController } from './auth.controller';
import { AuthValidation } from './auth.validation';

const r = createModuleRouter(
  '/auth',
  'Auth',
  'Registration, login, tokens and password management. Refresh token lives in an httpOnly cookie.',
);

r.post(
  '/register',
  {
    summary: 'Register a customer account',
    access: 'public',
    before: [authLimiter],
    body: AuthValidation.register,
  },
  AuthController.register,
);

r.post(
  '/verify-email',
  {
    summary: 'Verify email with the token from the email link',
    access: 'public',
    body: AuthValidation.token,
    successStatus: 200,
  },
  AuthController.verifyEmail,
);

r.post(
  '/resend-verification',
  {
    summary: 'Resend the verification email',
    access: 'public',
    before: [authLimiter],
    body: AuthValidation.email,
    successStatus: 200,
  },
  AuthController.resendVerification,
);

r.post(
  '/login',
  {
    summary: 'Login',
    description: 'Returns `accessToken` + user profile. Sets the `refreshToken` httpOnly cookie.',
    access: 'public',
    before: [authLimiter],
    body: AuthValidation.login,
    successStatus: 200,
  },
  AuthController.login,
);

r.post(
  '/refresh-token',
  {
    summary: 'Get a new access token',
    description:
      'Reads the `refreshToken` cookie, rotates it and returns a new `accessToken`. ' +
      'Frontend must call with `credentials: "include"`.',
    access: 'public',
    successStatus: 200,
  },
  AuthController.refreshToken,
);

r.post(
  '/logout',
  { summary: 'Logout (revokes the refresh token cookie)', access: 'public', successStatus: 200 },
  AuthController.logout,
);

r.post(
  '/forgot-password',
  {
    summary: 'Send a password reset email',
    access: 'public',
    before: [authLimiter],
    body: AuthValidation.email,
    successStatus: 200,
  },
  AuthController.forgotPassword,
);

r.post(
  '/reset-password',
  {
    summary: 'Reset password with the token from the email link',
    access: 'public',
    before: [authLimiter],
    body: AuthValidation.resetPassword,
    successStatus: 200,
  },
  AuthController.resetPassword,
);

r.patch(
  '/change-password',
  {
    summary: 'Change password (logs out other devices)',
    access: 'auth',
    body: AuthValidation.changePassword,
  },
  AuthController.changePassword,
);

r.get('/me', { summary: 'My profile + permission slugs', access: 'auth' }, AuthController.getMe);

r.patch(
  '/me',
  { summary: 'Update my profile', access: 'auth', body: AuthValidation.updateMe },
  AuthController.updateMe,
);

export const authRoutes = r;
