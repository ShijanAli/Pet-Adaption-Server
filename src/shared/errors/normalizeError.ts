import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { Prisma } from '@generated/prisma/client';
import { MulterError } from 'multer';
import jwt from 'jsonwebtoken';
import { AppError, type ErrorDetail } from './AppError';

export type NormalizedError = {
  statusCode: number;
  message: string;
  errors?: ErrorDetail[];
};

const fromZod = (err: ZodError): NormalizedError => ({
  statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
  message: 'Validation failed',
  errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});

const fromPrismaKnown = (err: Prisma.PrismaClientKnownRequestError): NormalizedError => {
  switch (err.code) {
    case 'P2002': {
      const meta = err.meta as
        { target?: string[] | string; driverAdapterError?: unknown } | undefined;
      const fields = Array.isArray(meta?.target) ? meta.target : meta?.target ? [meta.target] : [];
      const label = fields.length ? fields.join(', ') : 'field';
      return {
        statusCode: StatusCodes.CONFLICT,
        message: `A record with this ${label} already exists`,
        errors: fields.map((f) => ({ path: f, message: 'Already exists' })),
      };
    }
    case 'P2025':
      return { statusCode: StatusCodes.NOT_FOUND, message: 'Record not found' };
    case 'P2003':
      return {
        statusCode: StatusCodes.CONFLICT,
        message: 'Operation failed because of a related record (foreign key constraint)',
      };
    case 'P2000':
      return { statusCode: StatusCodes.BAD_REQUEST, message: 'Value too long for a column' };
    default:
      return { statusCode: StatusCodes.BAD_REQUEST, message: `Database error (${err.code})` };
  }
};

/** Converts any thrown value into the common error shape. */
export const normalizeError = (err: unknown): NormalizedError => {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message, errors: err.errors };
  }
  if (err instanceof ZodError) return fromZod(err);
  if (err instanceof Prisma.PrismaClientKnownRequestError) return fromPrismaKnown(err);
  if (err instanceof Prisma.PrismaClientValidationError) {
    return { statusCode: StatusCodes.BAD_REQUEST, message: 'Invalid data sent to the database' };
  }
  if (err instanceof jwt.TokenExpiredError) {
    return { statusCode: StatusCodes.UNAUTHORIZED, message: 'Access token expired' };
  }
  if (err instanceof jwt.JsonWebTokenError) {
    return { statusCode: StatusCodes.UNAUTHORIZED, message: 'Invalid access token' };
  }
  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? `Unexpected file field "${err.field}" or too many files`
          : err.message;
    return { statusCode: StatusCodes.BAD_REQUEST, message };
  }
  // body-parser JSON syntax error
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    return { statusCode: StatusCodes.BAD_REQUEST, message: 'Malformed JSON body' };
  }
  return { statusCode: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Something went wrong' };
};
