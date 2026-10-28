/* eslint-disable no-console */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolveTestDatabaseUrl } from './test-db-url';

/**
 * Runs once before the whole test suite:
 * 1. applies migrations to the test database
 * 2. truncates every table
 * 3. seeds permissions, roles, super admin …
 */
export default async function globalSetup() {
  const url = resolveTestDatabaseUrl();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = url;
  process.env.EMAIL_DRY_RUN = 'true';
  process.env.BCRYPT_SALT_ROUNDS = '4';

  if (process.env.TEST_SKIP_MIGRATE !== 'true') {
    if (!existsSync('prisma/migrations')) {
      throw new Error('No migrations found. Run `npm run prisma:migrate -- --name init` first.');
    }
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: url },
    });
  }

  const { prisma } = await import('@/lib/prisma');
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
  }

  const { seed } = await import('../../prisma/seed');
  await seed();
  await prisma.$disconnect();
  console.log('🧪 Test database ready');
}
