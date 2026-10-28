import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '@/shared/errors/AppError';
import { normalizeError } from '@/shared/errors/normalizeError';

describe('normalizeError', () => {
  it('keeps AppError status and message', () => {
    expect(normalizeError(AppError.notFound('Service'))).toEqual({
      statusCode: 404,
      message: 'Service not found',
      errors: undefined,
    });
  });

  it('maps zod errors to 422 with field paths', () => {
    const result = z
      .object({ body: z.object({ price: z.number() }) })
      .safeParse({ body: { price: 'x' } });
    const n = normalizeError(result.error);
    expect(n.statusCode).toBe(422);
    expect(n.errors?.[0].path).toBe('body.price');
  });

  it('hides unknown errors behind a generic 500', () => {
    expect(normalizeError(new Error('db password leaked'))).toEqual({
      statusCode: 500,
      message: 'Something went wrong',
    });
  });
});
