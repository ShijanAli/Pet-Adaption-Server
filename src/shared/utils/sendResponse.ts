import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ApiResponse<T> = {
  success: boolean;
  statusCode: number;
  message: string;
  meta?: PaginationMeta;
  data?: T;
};

type SendOptions<T> = {
  statusCode?: number;
  message: string;
  data?: T;
  meta?: PaginationMeta;
};

/** Every successful response goes through here, so the shape is always the same. */
export const sendResponse = <T>(res: Response, options: SendOptions<T>) => {
  const statusCode = options.statusCode ?? StatusCodes.OK;
  const body: ApiResponse<T> = {
    success: true,
    statusCode,
    message: options.message,
    ...(options.meta && { meta: options.meta }),
    data: options.data ?? (null as T),
  };
  return res.status(statusCode).json(body);
};
