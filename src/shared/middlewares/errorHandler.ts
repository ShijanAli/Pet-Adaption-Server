import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { AppError } from '@/shared/errors/AppError';
import { normalizeError } from '@/shared/errors/normalizeError';

export const notFoundHandler = (req: Request) => {
  throw new AppError(StatusCodes.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`);
};

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const { statusCode, message, errors } = normalizeError(err);

  if (statusCode >= 500) {
    logger.error({ err, path: req.originalUrl, method: req.method }, 'Unhandled error');
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(errors?.length && { errors }),
    ...(!env.isProduction && err instanceof Error && statusCode >= 500 && { stack: err.stack }),
  });
};
