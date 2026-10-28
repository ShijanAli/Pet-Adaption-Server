import { prisma, type TransactionClient } from '@/lib/prisma';

const isSerializationFailure = (err: unknown) => {
  const e = err as {
    code?: string;
    message?: string;
    meta?: { code?: string };
    cause?: { originalCode?: string };
  };
  return (
    e?.code === 'P2034' ||
    e?.meta?.code === '40001' ||
    e?.cause?.originalCode === '40001' ||
    /40001|could not serialize|write conflict/i.test(e?.message ?? '')
  );
};

/**
 * Runs a SERIALIZABLE transaction and retries when Postgres aborts it because a
 * concurrent transaction touched the same rows (e.g. two people booking the last slot).
 * On retry the losing request re-reads the data and gets a clean business error.
 */
export const serializableTransaction = async <T>(
  fn: (tx: TransactionClient) => Promise<T>,
  retries = 3,
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: 'Serializable', timeout: 15_000 });
    } catch (err) {
      if (attempt >= retries || !isSerializationFailure(err)) throw err;
      await new Promise((r) => setTimeout(r, 20 * attempt + Math.random() * 30));
    }
  }
};
