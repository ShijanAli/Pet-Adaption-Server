import { BookingService } from '@/modules/bookings/bookings.service';
import { cleanupTokens } from './cleanupTokens.job';
import { createScheduler, type Job } from './scheduler';

const MINUTE = 60_000;

export const JOBS: Job[] = [
  {
    name: 'expire-unpaid-bookings',
    everyMs: 5 * MINUTE,
    lockKey: 7_001,
    run: () => BookingService.expireUnpaid(),
  },
  {
    name: 'cleanup-tokens',
    everyMs: 6 * 60 * MINUTE,
    lockKey: 7_002,
    run: () => cleanupTokens(),
  },
];

export const scheduler = createScheduler(JOBS);
