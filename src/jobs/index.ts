import { cleanupTokens } from './cleanupTokens.job';
import { createScheduler, type Job } from './scheduler';

const MINUTE = 60_000;

export const JOBS: Job[] = [
  {
    name: 'cleanup-tokens',
    everyMs: 6 * 60 * MINUTE,
    lockKey: 7_002,
    run: () => cleanupTokens(),
  },
];

export const scheduler = createScheduler(JOBS);
