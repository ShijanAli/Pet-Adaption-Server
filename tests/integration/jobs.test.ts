import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { cleanupTokens } from '@/jobs/cleanupTokens.job';
import { JOBS } from '@/jobs';
import { runExclusive, type Job } from '@/jobs/scheduler';
import { API, api, bearer, createAndLogin } from '../helpers';

describe('Job registry', () => {
  it('never auto-cancels bookings for missing payment (online payment is off)', () => {
    expect(JOBS.map((j) => j.name)).toEqual(['cleanup-tokens']);
  });
});

describe('Job: cleanup tokens', () => {
  it('deletes expired / long-revoked tokens but keeps live ones', async () => {
    const { user } = await createAndLogin();
    const live = await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } });
    const old = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `old-${Date.now()}`,
        expiresAt: new Date(Date.now() - 3 * 86_400_000),
      },
    });
    const revoked = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `revoked-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: new Date(Date.now() - 40 * 86_400_000),
      },
    });

    const result = await cleanupTokens();
    expect(result.refreshTokens).toBeGreaterThanOrEqual(2);
    const remaining = await prisma.refreshToken.findMany({
      where: { id: { in: [live.id, old.id, revoked.id] } },
    });
    expect(remaining.map((t) => t.id)).toEqual([live.id]);
  });
});

describe('Scheduler', () => {
  it('runs a job only once at a time across processes (advisory lock)', async () => {
    let runs = 0;
    const job: Job = {
      name: 'slow-test-job',
      everyMs: 60_000,
      lockKey: 9_999,
      run: async () => {
        runs++;
        await new Promise((r) => setTimeout(r, 300));
      },
    };
    const results = await Promise.all([runExclusive(job), runExclusive(job)]);
    expect(runs).toBe(1);
    expect(results.filter((r) => r.skipped)).toHaveLength(1);
  });

  it('is not reachable over HTTP', async () => {
    const { accessToken } = await createAndLogin();
    await api().post(`${API}/jobs/run`).set(bearer(accessToken)).expect(404);
  });
});
