import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendResponse } from '@/shared/utils/sendResponse';
import { AuthService } from './auth.service';
import {
  clearRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from './auth.constant';
import type { ClientMeta } from './auth.interface';

const clientMeta = (req: Request): ClientMeta => ({
  userAgent: req.get('user-agent'),
  ipAddress: req.ip,
});

const readRefreshToken = (req: Request): string | undefined =>
  req.cookies?.[REFRESH_COOKIE_NAME] ?? undefined;

const setRefreshCookie = (res: Response, token: string) =>
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());

const GENERIC_EMAIL_MESSAGE = 'If an account exists for this email, we have sent you an email';

export const AuthController = {
  async register(req: Request, res: Response) {
    const data = await AuthService.register(req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Registration successful. Please check your email to verify your account',
      data,
    });
  },

  async verifyEmail(req: Request, res: Response) {
    await AuthService.verifyEmail(req.body.token);
    sendResponse(res, { message: 'Email verified successfully. You can now login' });
  },

  async resendVerification(req: Request, res: Response) {
    await AuthService.resendVerification(req.body.email);
    sendResponse(res, { message: GENERIC_EMAIL_MESSAGE });
  },

  async login(req: Request, res: Response) {
    const { refreshToken, accessToken, user } = await AuthService.login(req.body, clientMeta(req));
    setRefreshCookie(res, refreshToken);
    sendResponse(res, { message: 'Logged in successfully', data: { accessToken, user } });
  },

  async refreshToken(req: Request, res: Response) {
    const { accessToken, refreshToken } = await AuthService.refresh(
      readRefreshToken(req),
      clientMeta(req),
    );
    setRefreshCookie(res, refreshToken);
    sendResponse(res, { message: 'Token refreshed successfully', data: { accessToken } });
  },

  async logout(req: Request, res: Response) {
    await AuthService.logout(readRefreshToken(req));
    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());
    sendResponse(res, { message: 'Logged out successfully' });
  },

  async forgotPassword(req: Request, res: Response) {
    await AuthService.forgotPassword(req.body.email);
    sendResponse(res, { message: GENERIC_EMAIL_MESSAGE });
  },

  async resetPassword(req: Request, res: Response) {
    await AuthService.resetPassword(req.body.token, req.body.password);
    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());
    sendResponse(res, {
      message: 'Password reset successfully. Please login with your new password',
    });
  },

  async changePassword(req: Request, res: Response) {
    await AuthService.changePassword(
      req.user!.id,
      req.body.currentPassword,
      req.body.newPassword,
      readRefreshToken(req),
    );
    sendResponse(res, { message: 'Password changed successfully' });
  },

  async getMe(req: Request, res: Response) {
    const data = await AuthService.getMe(req.user!.id);
    sendResponse(res, { message: 'Profile retrieved successfully', data });
  },

  async updateMe(req: Request, res: Response) {
    const data = await AuthService.updateMe(req.user!.id, req.body);
    sendResponse(res, { message: 'Profile updated successfully', data });
  },
};
