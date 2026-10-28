import { Router, type RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { ZodType } from 'zod';
import { registerDocRoute, registerDocTag } from '@/docs/openapi';
import { authenticate, authorize } from '@/shared/middlewares/auth';
import { validateRequest } from '@/shared/middlewares/validateRequest';
import { activityLogService } from '@/shared/services/activityLog.service';
import type { PermissionSlug } from '@/shared/constants/permissions';

/**
 * - 'public'   → anyone
 * - 'optional' → anyone, `req.user` is set when a valid token is sent
 * - 'auth'     → any logged-in user
 * - { permissions } → logged-in user whose role has ALL permissions
 */
export type RouteAccess = 'public' | 'optional' | 'auth' | { permissions: PermissionSlug[] };

export type RouteConfig = {
  summary: string;
  description?: string;
  access: RouteAccess;
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
  /** Runs after auth and before validation (rate limiters, multer …) */
  before?: RequestHandler[];
  /** For swagger: multipart field name → single/multiple file */
  multipart?: Record<string, 'file' | 'files'>;
  successStatus?: number;
  /**
   * Write an activity log row after success.
   * Default: on for POST / PUT / PATCH / DELETE routes that require a permission.
   */
  audit?: boolean;
};

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * One place to declare a route: auth + permission + validation + swagger docs.
 *
 * @example
 * const r = createModuleRouter('/roles', 'Roles');
 * r.get('/:id', { summary: 'Get role', access: { permissions: [P.ROLE.VIEW] }, params: idParam }, RoleController.getById);
 * export const roleRoutes = r;
 */
export const createModuleRouter = (basePath: string, tag: string, tagDescription?: string) => {
  const router = Router();
  registerDocTag(tag, tagDescription);

  const add =
    (method: Method) =>
    (path: string, config: RouteConfig, ...handlers: RequestHandler[]) => {
      const chain: RequestHandler[] = [];

      if (config.access === 'optional') chain.push(authenticate({ optional: true }));
      else if (config.access !== 'public') chain.push(authenticate());

      if (typeof config.access === 'object') chain.push(authorize(...config.access.permissions));

      const fullPath = `${basePath}${path === '/' ? '' : path}`;
      const audit = config.audit ?? (typeof config.access === 'object' && method !== 'get');
      if (audit) {
        chain.push(
          activityLogService.middleware({
            modelType: tag,
            route: fullPath,
            summary: config.summary,
          }),
        );
      }
      if (config.before) chain.push(...config.before);
      if (config.body || config.query || config.params) {
        chain.push(
          validateRequest({ body: config.body, query: config.query, params: config.params }),
        );
      }

      router[method](path, ...chain, ...handlers);

      registerDocRoute({
        method,
        path: fullPath,
        tag,
        summary: config.summary,
        description: config.description,
        access: config.access,
        body: config.body,
        query: config.query,
        params: config.params,
        multipart: config.multipart,
        successStatus:
          config.successStatus ?? (method === 'post' ? StatusCodes.CREATED : StatusCodes.OK),
        paginated: Boolean(
          config.query &&
          'shape' in config.query &&
          'page' in (config.query as unknown as { shape: object }).shape,
        ),
      });
    };

  return {
    basePath,
    router,
    get: add('get'),
    post: add('post'),
    put: add('put'),
    patch: add('patch'),
    delete: add('delete'),
  };
};

export type ModuleRouter = ReturnType<typeof createModuleRouter>;
