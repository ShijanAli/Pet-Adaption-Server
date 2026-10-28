import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { apiRouter } from '@/routes';
import { buildOpenApiDocument } from '@/docs/openapi';
import { globalLimiter } from '@/shared/middlewares/rateLimiter';
import { errorHandler, notFoundHandler } from '@/shared/middlewares/errorHandler';
import { sendResponse } from '@/shared/utils/sendResponse';

export const createApp = (): Express => {
  const app = express();

  // behind a proxy (Render, Railway, Nginx) so req.ip & secure cookies work
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        // allow server-to-server / curl (no origin) and whitelisted frontends
        if (!origin || env.CLIENT_URLS.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      credentials: true, // required for the httpOnly refresh cookie across domains
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  // SSLCommerz posts callbacks as x-www-form-urlencoded
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(hpp());
  app.use(compression());
  app.use(
    pinoHttp({
      logger,
      // correlate logs: reuse the proxy's X-Request-Id or create one, and echo it back
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && incoming.length <= 100 ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/health' },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    }),
  );

  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    sendResponse(res, { message: 'OK', data: { uptime: process.uptime() } });
  });

  app.use(env.API_PREFIX, globalLimiter, apiRouter);

  // API docs (built after all routes registered themselves)
  const openApiDocument = buildOpenApiDocument();
  app.get('/docs.json', (_req, res) => res.json(openApiDocument));
  app.use(
    '/docs',
    // swagger UI needs inline scripts — relax CSP for this route only
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: `${env.APP_NAME} API Docs`,
      swaggerOptions: { persistAuthorization: true, withCredentials: true },
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
