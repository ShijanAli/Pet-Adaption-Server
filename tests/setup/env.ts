import { resolveTestDatabaseUrl } from './test-db-url';

// Runs before every test file (before app code is imported)
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.EMAIL_DRY_RUN = 'true';
process.env.BCRYPT_SALT_ROUNDS = '4'; // fast hashing in tests
process.env.JOBS_ENABLED = 'false';
