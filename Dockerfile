# syntax=docker/dockerfile:1

# ── 1. install all dependencies (generates the Prisma client) ──────────────
FROM node:22-alpine AS deps
WORKDIR /app
# prisma.config.ts reads DATABASE_URL — a placeholder is enough to generate the client
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# ── 2. build + strip dev dependencies ──────────────────────────────────────
FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

# ── 3. small runtime image ─────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts /app/package.json ./

USER app
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-5000}/health" > /dev/null || exit 1

# apply pending migrations, then start the API
CMD ["npm", "run", "start:prod"]
