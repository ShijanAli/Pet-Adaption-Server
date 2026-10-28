import { prisma } from '@/lib/prisma';

const DAY = 86_400_000;

/** Removes refresh / verification tokens that can never be used again */
export const cleanupTokens = async (now = new Date()) => {
  const [refresh, verification] = await Promise.all([
    prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date(now.getTime() - DAY) } },
          // revoked tokens are kept 30 days for reuse detection
          { revokedAt: { lt: new Date(now.getTime() - 30 * DAY) } },
        ],
      },
    }),
    prisma.verificationToken.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - DAY) } },
    }),
  ]);
  return { refreshTokens: refresh.count, verificationTokens: verification.count };
};
