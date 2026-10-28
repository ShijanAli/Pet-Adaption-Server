import { StatusCodes } from 'http-status-codes';

export type ErrorDetail = { path: string; message: string };

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors?: ErrorDetail[];
  public readonly isOperational = true;

  constructor(statusCode: number, message: string, errors?: ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Bad request', errors?: ErrorDetail[]) {
    return new AppError(StatusCodes.BAD_REQUEST, message, errors);
  }

  static unauthorized(message = 'You are not authorized') {
    return new AppError(StatusCodes.UNAUTHORIZED, message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(StatusCodes.FORBIDDEN, message);
  }

  static notFound(resource = 'Resource') {
    return new AppError(StatusCodes.NOT_FOUND, `${resource} not found`);
  }

  static conflict(message: string) {
    return new AppError(StatusCodes.CONFLICT, message);
  }

  static unprocessable(message: string, errors?: ErrorDetail[]) {
    return new AppError(StatusCodes.UNPROCESSABLE_ENTITY, message, errors);
  }

  static serviceUnavailable(message: string) {
    return new AppError(StatusCodes.SERVICE_UNAVAILABLE, message);
  }
}
