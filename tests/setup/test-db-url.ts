import 'dotenv/config';

/** Resolves the test database URL and refuses to run against anything that isn't a test DB. */
export const resolveTestDatabaseUrl = () => {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/pet_adoption_test?schema=public';

  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.includes('test')) {
    throw new Error(
      `Refusing to run tests against "${dbName}". TEST_DATABASE_URL must point to a database whose name contains "test".`,
    );
  }
  return url;
};
