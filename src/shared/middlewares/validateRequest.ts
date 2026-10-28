import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

export type RequestSchemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

/**
 * Validates & coerces body / query / params with zod.
 * Parsed values replace the raw ones, so controllers always receive clean, typed data.
 */
export const validateRequest =
  (schemas: RequestSchemas) => async (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.params) {
      req.params = (await schemas.params.parseAsync(req.params)) as Request['params'];
    }
    if (schemas.query) {
      const query = await schemas.query.parseAsync(req.query);
      // Express 5 exposes req.query as a getter — shadow it with the parsed value
      Object.defineProperty(req, 'query', {
        value: query,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    if (schemas.body) {
      req.body = await schemas.body.parseAsync(req.body ?? {});
    }
    next();
  };
