import type { NextFunction, Request, Response } from 'express';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

const SECRET_KEY = /pass(word)?|token|secret|card|cvv/i;
const MAX_BODY_CHARS = 8_000;

/** Removes secrets and caps the size before storing request bodies */
const sanitize = (value: unknown, depth = 0): unknown => {
  if (depth > 5 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      SECRET_KEY.test(k) ? '[redacted]' : sanitize(v, depth + 1),
    ]),
  );
};

const ACTIONS: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

export const activityLogService = {
  record(entry: {
    userId: number | null;
    action: string;
    modelType: string;
    modelId?: number | null;
    oldValues?: unknown;
    newValues?: unknown;
    ipAddress?: string;
    userAgent?: string;
  }) {
    prisma.activityLog
      .create({
        data: {
          ...entry,
          action: entry.action.slice(0, 50),
          modelType: entry.modelType.slice(0, 100),
          oldValues: entry.oldValues as object | undefined,
          newValues: entry.newValues as object | undefined,
          userAgent: entry.userAgent?.slice(0, 255),
        },
      })
      .catch((err) => logger.error({ err }, 'Failed to write activity log'));
  },

  /**
   * Middleware added automatically by createModuleRouter to every admin write route.
   * Writes one row after a successful (2xx) response.
   */
  middleware(meta: { modelType: string; route: string; summary: string }) {
    return (req: Request, res: Response, next: NextFunction) => {
      res.on('finish', () => {
        if (res.statusCode >= 400 || !req.user) return;
        const id = Number(req.params.id);
        let body = sanitize(req.body);
        if (JSON.stringify(body ?? null).length > MAX_BODY_CHARS) body = '[too large]';

        activityLogService.record({
          userId: req.user.id,
          action: ACTIONS[req.method] ?? req.method.toLowerCase(),
          modelType: meta.modelType,
          modelId: Number.isInteger(id) && id > 0 ? id : null,
          newValues: { route: `${req.method} ${meta.route}`, summary: meta.summary, body },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      });
      next();
    };
  },
};
