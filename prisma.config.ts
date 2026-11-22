import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Multi-file schema: every *.prisma file inside this folder is merged
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // The CLI (migrate deploy) needs a DIRECT, non-pooled connection: Postgres
    // advisory locks don't work through PgBouncer/poolers and time out (P1002).
    // The app itself connects via DATABASE_URL (see src/lib/prisma.ts).
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
