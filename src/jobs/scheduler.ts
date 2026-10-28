import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export type Job = {
  name: string;
  /** How often the job runs */
  everyMs: number;
  /** Unique number for the Postgres advisory lock */
  lockKey: number;
  run: () => Promise<unknown>;
};

/**
 * Runs a job only if no other process is running it right now.
 * `pg_try_advisory_xact_lock` is held for the lifetime of the transaction, so with
 * several API instances (or containers) each job still runs once at a time.
 */
export const runExclusive = async (job: Job) =>
  prisma.$transaction(
    async (tx) => {
      const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${job.lockKey}) AS locked`;
      if (!locked) return { skipped: true as const };
      const started = Date.now();
      const result = await job.run();
      logger.info({ job: job.name, ms: Date.now() - started, result }, 'Job finished');
      return { skipped: false as const, result };
    },
    { timeout: Math.max(job.everyMs, 60_000), maxWait: 10_000 },
  );

export const createScheduler = (jobs: Job[]) => {
  const timers: NodeJS.Timeout[] = [];
  const running = new Set<string>();

  const tick = async (job: Job) => {
    if (running.has(job.name)) return; // previous run still busy in this process
    running.add(job.name);
    try {
      await runExclusive(job);
    } catch (err) {
      logger.error({ err, job: job.name }, 'Job failed');
    } finally {
      running.delete(job.name);
    }
  };

  return {
    start() {
      for (const job of jobs) {
        // small random delay so many instances don't hit the DB at the same second
        const first = setTimeout(() => void tick(job), 5_000 + Math.random() * 5_000);
        const every = setInterval(() => void tick(job), job.everyMs);
        first.unref();
        every.unref();
        timers.push(first, every);
      }
      logger.info({ jobs: jobs.map((j) => j.name) }, '⏱️  Background jobs scheduled');
    },
    stop() {
      timers.forEach(clearTimeout);
      timers.length = 0;
    },
  };
};
