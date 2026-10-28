/* eslint-disable no-console */
/**
 * Generates a Postman v2.1 collection from the OpenAPI document,
 * so Swagger and Postman never drift apart.
 *
 *   npm run docs:postman  →  postman/pet-adoption.postman_collection.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createApp } from '@/app';
import { env } from '@/config/env';
import { buildOpenApiDocument } from '@/docs/openapi';

type JsonSchema = {
  type?: string;
  format?: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  nullable?: boolean;
};

const SAMPLE_BY_NAME: Record<string, unknown> = {
  email: 'customer@example.com',
  password: 'Password@123',
  currentPassword: 'Password@123',
  newPassword: 'NewPassword@123',
  firstName: 'John',
  lastName: 'Doe',
  name: 'Sample name',
  phone: '+8801700000000',
  token: 'paste-token-from-email',
  publicId: 'pet-adoption/misc/abc123',
};

const sample = (schema: JsonSchema | undefined, key = ''): unknown => {
  if (!schema) return null;
  if (key in SAMPLE_BY_NAME) return SAMPLE_BY_NAME[key];
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.anyOf?.length)
    return sample(
      schema.anyOf.find((s) => s.type !== 'null'),
      key,
    );

  switch (schema.type) {
    case 'object': {
      // create bodies → required fields only; PATCH bodies (nothing required) → every field
      const required = schema.required ?? [];
      return Object.fromEntries(
        Object.entries(schema.properties ?? {})
          .filter(([k]) => required.length === 0 || required.includes(k))
          .map(([k, v]) => [k, sample(v, k)]),
      );
    }
    case 'array':
      return schema.items ? [sample(schema.items, key)] : [];
    case 'integer':
    case 'number':
      return schema.minimum && schema.minimum > 0 ? schema.minimum : 1;
    case 'boolean':
      return true;
    case 'string':
      if (/^(is|has)[A-Z]/.test(key)) return 'true';
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'uri') return 'https://example.com/image.png';
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.format === 'date') return new Date().toISOString().slice(0, 10);
      return key ? `sample ${key}` : 'string';
    default:
      return null;
  }
};

type Operation = {
  tags: string[];
  summary: string;
  description: string;
  security?: unknown[];
  parameters: { name: string; in: 'path' | 'query'; required: boolean; schema: JsonSchema }[];
  requestBody?: { content: Record<string, { schema: JsonSchema }> };
};

createApp(); // registers every route
const doc = buildOpenApiDocument();

const folders = new Map<string, unknown[]>();

for (const [path, methods] of Object.entries(doc.paths)) {
  for (const [method, op] of Object.entries(methods as Record<string, Operation>)) {
    const postmanPath = path.replace(/\{(\w+)\}/g, ':$1');
    const pathParams = op.parameters.filter((p) => p.in === 'path');
    const queryParams = op.parameters.filter((p) => p.in === 'query');

    const request: Record<string, unknown> = {
      method: method.toUpperCase(),
      description: op.description,
      header: [],
      url: {
        raw: `{{baseUrl}}${postmanPath}`,
        host: ['{{baseUrl}}'],
        path: postmanPath.split('/').filter(Boolean),
        variable: pathParams.map((p) => ({ key: p.name, value: '1' })),
        query: queryParams.map((p) => ({
          key: p.name,
          value: String(sample(p.schema, p.name) ?? ''),
          disabled: !p.required,
        })),
      },
      ...(!op.security && { auth: { type: 'noauth' } }),
    };

    const json = op.requestBody?.content['application/json'];
    const form = op.requestBody?.content['multipart/form-data'];
    if (json) {
      request.header = [{ key: 'Content-Type', value: 'application/json' }];
      request.body = {
        mode: 'raw',
        raw: JSON.stringify(sample(json.schema), null, 2),
        options: { raw: { language: 'json' } },
      };
    } else if (form) {
      request.body = {
        mode: 'formdata',
        formdata: Object.keys(form.schema.properties ?? {}).map((key) => ({
          key,
          type: 'file',
          src: [],
        })),
      };
    }

    // login & refresh store the access token automatically
    const savesToken = path === '/auth/login' || path === '/auth/refresh-token';
    const item = {
      name: op.summary,
      request,
      ...(savesToken && {
        event: [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                'const body = pm.response.json();',
                'if (body?.data?.accessToken) {',
                "  pm.collectionVariables.set('accessToken', body.data.accessToken);",
                '}',
              ],
            },
          },
        ],
      }),
    };

    const tag = op.tags[0] ?? 'Other';
    folders.set(tag, [...(folders.get(tag) ?? []), item]);
  }
}

const collection = {
  info: {
    name: `${env.APP_NAME} API`,
    description:
      'Generated from the OpenAPI spec. Run "Auth → Login" first — the access token is saved automatically. ' +
      'Postman keeps the refreshToken cookie for "Get a new access token".',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] },
  variable: [
    { key: 'baseUrl', value: `${env.SERVER_URL}${env.API_PREFIX}` },
    { key: 'accessToken', value: '' },
  ],
  item: [...folders].map(([name, item]) => ({ name, item })),
};

mkdirSync('postman', { recursive: true });
const file = 'postman/pet-adoption.postman_collection.json';
writeFileSync(file, `${JSON.stringify(collection, null, 2)}\n`);
console.log(`✅ Postman collection written to ${file} (${folders.size} folders)`);
process.exit(0);
