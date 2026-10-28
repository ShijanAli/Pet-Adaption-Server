import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { scheduler } from '@/jobs';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Server running on ${env.SERVER_URL}${env.API_PREFIX}`);
  logger.info(`📚 API docs at ${env.SERVER_URL}/docs`);
  if (env.JOBS_ENABLED) scheduler.start();
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully…`);
  scheduler.stop();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // force exit if connections hang
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
