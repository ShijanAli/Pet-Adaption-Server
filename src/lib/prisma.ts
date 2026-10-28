import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@generated/prisma/client';
import { env } from '@/config/env';

/**
 * Models that have a `deletedAt` column.
 * Read queries on these models automatically exclude soft-deleted rows.
 * Pass `deletedAt` explicitly in `where` to override (e.g. `{ deletedAt: { not: null } }`).
 * Deleting is explicit: use `softDelete()` from the CRUD factory / services.
 */
export const SOFT_DELETE_MODELS = new Set<Prisma.ModelName>([
  'User',
  'Pet',
  'ServiceCategory',
  'Service',
  'AdoptionPet',
  'BlogPost',
]);

const READ_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const createPrismaClient = () => {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  const client = new PrismaClient({
    adapter,
    // test runs provoke expected errors (e.g. retried serialization conflicts) — keep output clean
    log: env.isDevelopment ? ['warn', 'error'] : env.isTest ? [] : ['error'],
    // password hash never leaves the DB unless explicitly requested with omit: { password: false }
    omit: { user: { password: true } },
  });

  return client.$extends({
    name: 'soft-delete-filter',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (SOFT_DELETE_MODELS.has(model as Prisma.ModelName) && READ_OPERATIONS.has(operation)) {
            const a = (args ?? {}) as { where?: Record<string, unknown> };
            if (!a.where || !('deletedAt' in a.where)) {
              a.where = { ...a.where, deletedAt: null };
            }
            return query(a as typeof args);
          }
          return query(args);
        },
      },
    },
  });
};

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!env.isProduction) globalForPrisma.prisma = prisma;

/** Client type inside `prisma.$transaction(async (tx) => …)` */
export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
