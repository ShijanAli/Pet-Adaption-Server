import { z, type ZodType } from 'zod';
import { env } from '@/config/env';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type DocRoute = {
  method: HttpMethod;
  path: string; // express style: /roles/:id
  tag: string;
  summary: string;
  description?: string;
  access: 'public' | 'optional' | 'auth' | { permissions: readonly string[] };
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
  multipart?: Record<string, 'file' | 'files'>;
  successStatus: number;
  paginated: boolean;
};

const routes: DocRoute[] = [];
const tagDescriptions = new Map<string, string | undefined>();

export const registerDocRoute = (route: DocRoute) => routes.push(route);
export const registerDocTag = (name: string, description?: string) =>
  tagDescriptions.set(name, description);

const toSchema = (schema: ZodType) =>
  z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input', unrepresentable: 'any' }) as {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  } & Record<string, unknown>;

const toParameters = (schema: ZodType | undefined, location: 'query' | 'path') => {
  if (!schema) return [];
  const json = toSchema(schema);
  return Object.entries(json.properties ?? {}).map(([name, prop]) => ({
    name,
    in: location,
    required: location === 'path' || (json.required ?? []).includes(name),
    schema: prop,
    ...(typeof prop.description === 'string' && { description: prop.description }),
  }));
};

const toOpenApiPath = (path: string) => path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

const accessDescription = (access: DocRoute['access']) => {
  if (access === 'public') return '🌐 Public';
  if (access === 'optional') return '🌐 Public (login optional)';
  if (access === 'auth') return '🔑 Login required';
  return `🛡️ Permission: \`${access.permissions.join('`, `')}\``;
};

const errorRef = { $ref: '#/components/responses/Error' };

const buildOperation = (r: DocRoute) => {
  const isPrivate = r.access === 'auth' || typeof r.access === 'object';
  const responses: Record<string, unknown> = {
    [r.successStatus]: {
      description: 'Success',
      content: {
        'application/json': {
          schema: {
            $ref: r.paginated
              ? '#/components/schemas/PaginatedResponse'
              : '#/components/schemas/SuccessResponse',
          },
        },
      },
    },
  };
  if (r.body || r.query || r.params || r.multipart) responses[422] = errorRef;
  if (isPrivate) responses[401] = errorRef;
  if (typeof r.access === 'object') responses[403] = errorRef;

  let requestBody: unknown;
  if (r.multipart) {
    const properties: Record<string, unknown> = {};
    for (const [field, kind] of Object.entries(r.multipart)) {
      properties[field] =
        kind === 'file'
          ? { type: 'string', format: 'binary' }
          : { type: 'array', items: { type: 'string', format: 'binary' } };
    }
    requestBody = {
      required: true,
      content: { 'multipart/form-data': { schema: { type: 'object', properties } } },
    };
  } else if (r.body) {
    requestBody = { required: true, content: { 'application/json': { schema: toSchema(r.body) } } };
  }

  return {
    tags: [r.tag],
    summary: r.summary,
    description: [accessDescription(r.access), r.description].filter(Boolean).join('\n\n'),
    ...(isPrivate && { security: [{ bearerAuth: [] }] }),
    parameters: [...toParameters(r.params, 'path'), ...toParameters(r.query, 'query')],
    ...(requestBody ? { requestBody } : {}),
    responses,
  };
};

export const buildOpenApiDocument = () => {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routes) {
    const p = toOpenApiPath(r.path);
    paths[p] ??= {};
    paths[p][r.method] = buildOperation(r);
  }

  return {
    openapi: '3.0.3',
    info: {
      title: `${env.APP_NAME} API`,
      version: '1.0.0',
      description:
        'REST API for the Pet Adoption & Pet Care Services platform.\n\n' +
        '**Auth:** call `POST /auth/login`, then click **Authorize** and paste the `accessToken`. ' +
        'The refresh token is stored in an httpOnly cookie.\n\n' +
        '**List endpoints** support `page`, `limit`, `searchTerm`, `sortBy`, `sortOrder` and module specific filters.',
    },
    servers: [{ url: `${env.SERVER_URL}${env.API_PREFIX}` }],
    tags: [...tagDescriptions].map(([name, description]) => ({ name, description })),
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 10 },
            total: { type: 'integer', example: 57 },
            totalPages: { type: 'integer', example: 6 },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            statusCode: { type: 'integer', example: 200 },
            message: { type: 'string' },
            data: { nullable: true },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            statusCode: { type: 'integer', example: 200 },
            message: { type: 'string' },
            meta: { $ref: '#/components/schemas/PaginationMeta' },
            data: { type: 'array', items: {} },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            statusCode: { type: 'integer', example: 422 },
            message: { type: 'string', example: 'Validation failed' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: { path: { type: 'string' }, message: { type: 'string' } },
              },
            },
          },
        },
      },
      responses: {
        Error: {
          description: 'Error',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
      },
    },
    paths,
  };
};

export type OpenApiDocument = ReturnType<typeof buildOpenApiDocument>;
