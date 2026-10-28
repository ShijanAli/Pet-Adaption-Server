# Pet Adoption & Pet Care — Backend API

Production-ready REST API for a pet adoption + pet care services platform.

**Stack:** Node 22 · Express 5 · TypeScript (strict) · Prisma 7 · PostgreSQL · Zod 4 · JWT · Brevo · Cloudinary ·
SSLCommerz · Vitest + Supertest

**In numbers:** 30 modules · 185 endpoints · 40 tables · 149 tests (~96 % line coverage)

---

## Table of contents

1. [Quick start](#quick-start)
2. [Environment variables](#environment-variables)
3. [Scripts](#scripts)
4. [Project structure](#project-structure)
5. [Conventions](#conventions)
6. [Auth & RBAC](#auth--rbac)
7. [Modules & main flows](#modules--main-flows)
8. [Background jobs](#background-jobs)
9. [Testing](#testing)
10. [Deployment](#deployment)
11. [Production checklist](#production-checklist)

---

## Quick start

```bash
npm install                    # also runs `prisma generate`
cp .env.example .env           # fill in Brevo / Cloudinary / SSLCommerz keys when ready
docker compose up -d           # Postgres with pet_adoption + pet_adoption_test databases

npx prisma migrate dev --name init
npm run db:seed                # permissions, roles, super admin, pet types, settings

npm run dev
```

| URL                                             | What                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `http://localhost:5000/api/v1`                  | API                                                                               |
| `http://localhost:5000/docs`                    | Swagger UI (`/docs.json` = OpenAPI spec)                                          |
| `postman/…postman_collection.json`              | Postman collection — run **Auth → Login** first, the token is saved automatically |
| `superadmin@petadoption.com` / `SuperAdmin@123` | Seeded super admin (change `SEED_SUPER_ADMIN_*` before seeding in production)     |

> With `EMAIL_DRY_RUN=true` no email is sent — the console log shows each email with its action link
> (verify email, reset password …), so you can test every flow without an inbox.

> **Upgrading from an earlier phase zip?** The schema changed in phase 3 (`payments.refund_of_id`, `note`) and phase 4
> (`adoptions.status`, `fee_amount`, …). Run `npx prisma migrate dev` once. If nothing is deployed yet, the simplest is
> to delete `prisma/migrations` and create a single fresh `init` migration.

---

## Environment variables

All variables are validated with zod at startup (`src/config/env.ts`) — the app refuses to start with a bad config.

| Variable                                                                      | Default         | Notes                                              |
| ----------------------------------------------------------------------------- | --------------- | -------------------------------------------------- |
| `NODE_ENV`                                                                    | `development`   | `production` enables secure cross-site cookies     |
| `PORT`                                                                        | `5000`          |                                                    |
| `API_PREFIX`                                                                  | `/api/v1`       |                                                    |
| `SERVER_URL`                                                                  | —               | Public backend URL (SSLCommerz callbacks, Swagger) |
| `CLIENT_URL`                                                                  | —               | Frontend URL used in emails and payment redirects  |
| `CLIENT_URLS`                                                                 | —               | Comma separated CORS whitelist                     |
| `BUSINESS_TIMEZONE`                                                           | `Asia/Dhaka`    | Schedules, booking times, dashboard periods        |
| `DATABASE_URL` / `TEST_DATABASE_URL`                                          | —               | Test DB name **must contain `test`**               |
| `JWT_ACCESS_SECRET`                                                           | —               | ≥ 32 chars                                         |
| `JWT_ACCESS_EXPIRES_IN`                                                       | `15m`           |                                                    |
| `JWT_REFRESH_EXPIRES_IN_DAYS`                                                 | `7`             | Refresh token lifetime                             |
| `BCRYPT_SALT_ROUNDS`                                                          | `12`            |                                                    |
| `COOKIE_DOMAIN`                                                               | empty           | Only when API and frontend share a parent domain   |
| `EMAIL_VERIFY_TOKEN_EXPIRES_MINUTES` / `PASSWORD_RESET_TOKEN_EXPIRES_MINUTES` | `60` / `30`     |                                                    |
| `BREVO_API_KEY`, `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`                      | —               | Sender must be verified in Brevo                   |
| `EMAIL_DRY_RUN`                                                               | `false`         | `true` = log instead of send                       |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` / `_FOLDER`              | —               | Uploads return 503 until set                       |
| `UPLOAD_MAX_FILE_SIZE_MB`                                                     | `5`             |                                                    |
| `SSLCOMMERZ_STORE_ID` / `_STORE_PASSWORD` / `_IS_LIVE`                        | — / — / `false` | Sandbox by default                                 |
| `JOBS_ENABLED`                                                                | `true`          | Background jobs (see below)                        |
| `SEED_SUPER_ADMIN_EMAIL` / `_PASSWORD`                                        | —               | Used by the seed only                              |

Business settings (exchange rate, booking rules, contact info …) live in the `settings` table and are edited through
`PATCH /settings` — see [Settings](#settings-audit-log--dashboard).

---

## Scripts

| Script                                                       | What it does                                             |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| `npm run dev`                                                | Dev server with watch (tsx)                              |
| `npm run build`                                              | Bundle `dist/server.js` + `dist/seed.js` (tsup)          |
| `npm start` / `npm run start:prod`                           | Run the bundle / apply migrations, then run              |
| `npm run db:seed` / `npm run db:seed:prod`                   | Seed with tsx / with the compiled bundle (idempotent)    |
| `npm run prisma:migrate` / `prisma:deploy` / `prisma:studio` | Prisma helpers                                           |
| `npm test` / `npm run test:coverage`                         | Tests (wipes `TEST_DATABASE_URL`) / with coverage report |
| `npm run check`                                              | typecheck + lint + tests                                 |
| `npm run docs:postman`                                       | Regenerate the Postman collection from the OpenAPI spec  |
| `npm run lint` / `npm run format`                            | ESLint / Prettier                                        |

---

## Project structure

```
prisma/
  schema/                      multi-file schema — one file per domain
    schema.prisma              generator + datasource
    enums · auth · users · pets · services · staff · bookings · payments · promotions
    reviews · gallery · adoptions · content · system  (.prisma)
  seed.ts
src/
  app.ts · server.ts
  config/env.ts                zod-validated environment
  lib/                         prisma (soft-delete filter) · logger · brevo · cloudinary · sslcommerz
  docs/openapi.ts              OpenAPI built from the same zod schemas used for validation
  emails/                      layout + typed templates
  jobs/                        scheduler (advisory lock) + jobs
  routes/index.ts              registers every module router
  shared/
    constants/                 PERMISSIONS · system roles · SETTING_DEFINITIONS
    crud/                      generic CRUD service + controller factory
    errors/                    AppError + normalizeError (zod / prisma / jwt / multer → one format)
    http/createModuleRouter    auth + permission + validation + audit log + swagger in one declaration
    middlewares/               authenticate · authorize · validateRequest · upload · rate limiters · error handler
    services/                  email · notifications · settings · permission cache · activity log
    utils/                     queryBuilder · sendResponse · money · time · transaction (serializable retry) …
  modules/<name>/
    <name>.route.ts · .controller.ts · .service.ts · .validation.ts · .constant.ts (· .interface.ts)
tests/
  unit/ · integration/ · helpers/ · setup/
postman/                       generated collection
Dockerfile · docker-compose.yml
```

---

## Conventions

### One response format

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Services retrieved successfully",
  "meta": { "page": 1, "limit": 10, "total": 57, "totalPages": 6 },
  "data": []
}
```

```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "path": "email", "message": "Invalid email address" }]
}
```

Only exception: `GET /newsletter/subscribers/export` returns a CSV file.

### List endpoints

`?page=1&limit=10&searchTerm=rahim&sortBy=createdAt&sortOrder=desc&<filters>` — search, filter and sort fields are
whitelisted per module (zod rejects anything else with 422). `limit` ≤ 100.

### Declaring a route

```ts
const r = createModuleRouter('/faqs', 'FAQs');
r.post(
  '/',
  {
    summary: 'Create an FAQ',
    access: { permissions: [PERMISSIONS.FAQ.CREATE] }, // 'public' | 'optional' | 'auth' | { permissions }
    body: FaqValidation.create,
  },
  FaqController.create,
);
```

That one declaration adds authentication, the permission check, zod validation, the audit log and the Swagger entry.
Simple modules (FAQs, testimonials, blocked dates …) reuse `createCrudService` / `createCrudController`.

### Data rules

- Money: `Decimal(10,2)` in **BDT**, serialized as strings (`"1200.00"`) to avoid float errors.
- Dates without time (`bookingDate`, `adoptionDate` …) are `YYYY-MM-DD`; times are `HH:mm` in `BUSINESS_TIMEZONE`.
- Soft delete: users, pets, services, service categories, adoption pets, blog posts (`deletedAt`) — hidden from
  every read automatically by a Prisma client extension.
- Catalog endpoints (`/pet-types`, `/service-categories`, `/services`, `/adoption-pets`, `/gallery`, `/blog`, `/faqs`,
  `/testimonials`) use optional auth: the public gets active/published items only, users with the module permission
  also get inactive ones and can filter by `status`.

---

## Auth & RBAC

1. `POST /auth/register` → verification email → `POST /auth/verify-email`
2. `POST /auth/login` → `{ accessToken, user }` + `refreshToken` **httpOnly cookie** (scoped to `/api/v1/auth`)
3. Send `Authorization: Bearer <accessToken>` (15 min)
4. On 401 call `POST /auth/refresh-token` with `credentials: 'include'` → new access token. Refresh tokens rotate on
   every use; re-using an old one revokes every session of that user.
5. `user.permissions` (login / `GET /auth/me`) tells the frontend what to show.

Frontend and API on different domains → production cookie is `SameSite=None; Secure` (HTTPS required) and the
frontend origin must be in `CLIENT_URLS`. Use `credentials: 'include'` (fetch) / `withCredentials: true` (axios).

**RBAC:** 64 permissions (`module.action`) in `src/shared/constants/permissions.ts`, seeded into the DB. System roles:
`super_admin` (bypasses checks), `admin`, `staff`, `customer`. Custom roles via `/roles`. The user + role are loaded on
every request and role permissions are cached in memory and invalidated on change, so blocking a user or editing a role
applies instantly.

---

## Modules & main flows

| Area      | Modules                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| Identity  | Auth, Users, Roles, Permissions, Uploads (Cloudinary)                                                        |
| Catalog   | Pet types, Service categories (2 levels), Services, Staff schedules, Blocked dates, Availability             |
| Customers | My pets, My bookings, My payments, My favorites, My applications, My adoptions, My reviews, My notifications |
| Commerce  | Bookings, Promotions, Payments (SSLCommerz + counter), Refunds                                               |
| Adoption  | Adoption pets (+ images), Applications, Adoptions                                                            |
| Content   | Reviews, Gallery, Blog, FAQs, Testimonials, Contact, Newsletter                                              |
| System    | Settings, Activity logs, Dashboard                                                                           |

### Booking & payment

```
GET  /services/:id/availability?date=…        free slots (schedules, days off, existing bookings)
POST /promotions/validate                      optional promo preview
POST /bookings                                 pending + unpaid, least busy free staff assigned
POST /payments/init { bookingId, currency }    → redirect to gatewayUrl (BDT or USD)
     SSLCommerz → /payments/sslcommerz/success|fail|cancel → 303 to CLIENT_URL/payment/<result>?tranId=…&reference=…
     SSLCommerz → /payments/sslcommerz/ipn (server-to-server)
     verified with the SSLCommerz validation API (status, tran_id, amount, currency) → paid + confirmed + receipt
```

- Slot re-checked inside a **SERIALIZABLE** transaction with retry → two customers can never get the same staff
  member at the same time (the loser gets 409).
- Status workflow `pending → confirmed → in_progress → completed` (+ `cancelled`, `no_show`); staff can only update
  their own bookings.
- Customers cancel up to `booking_cancel_before_hours` before the start; promo use is given back.
- Unpaid bookings are auto-cancelled after `booking_payment_timeout_minutes` (job).
- Counter payments (`/payments/cash`, partial allowed) and full / partial refunds (gateway refund API for online payments).

**SSLCommerz sandbox:** create a store at <https://developer.sslcommerz.com/registration/>, set the keys, make
`SERVER_URL` reachable (e.g. `ngrok http 5000`), and add `/payment/success|failed|cancelled` pages to the frontend.

### Adoption

```
POST  /adoption-applications                 one open application per pet per user
PATCH /adoption-applications/:id/review      approve = pet locked + adoption record (fee snapshot) + others auto-rejected
POST  /payments/init { adoptionId }          or POST /payments/cash { adoptionId }
PATCH /adoptions/:id/complete                needs the full fee → pet adopted
PATCH /adoptions/:id/cancel                  only with nothing paid → pet available again
```

### Reviews & gallery

One review per **completed** booking, moderated; only approved reviews are public and count towards
`services.avgRating`. Gallery albums + items (image / video URL, before-after, linked service, bulk add, reorder).

### Settings, audit log & dashboard

- **Settings** are typed in `src/shared/constants/settings.ts` (default, group, public flag, zod schema); the seed,
  `PATCH /settings` (all-or-nothing validation) and `settingsService.get()` all use it. `GET /settings/public` feeds the
  frontend.
- **Activity log** is automatic for every admin write route (who, route, body with secrets redacted).
- **Notifications** for bookings, payments, adoptions and reviews (`/me/notifications`).
- **Dashboard**: `/stats`, `/revenue` (net, per day / month, business timezone, gaps filled), `/top-services`,
  `/bookings-by-status`.

---

## Background jobs

In-process scheduler (`src/jobs`). Each run takes a Postgres **advisory lock**, so with several instances a job still
runs once at a time. Disable with `JOBS_ENABLED=false` (e.g. to run them in a separate worker).

| Job                      | Every | What                                                                                                                                                              |
| ------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expire-unpaid-bookings` | 5 min | Cancels pending + unpaid bookings older than `booking_payment_timeout_minutes` (30; `0` = off). Skips customers who started a gateway payment in the last 15 min. |
| `cleanup-tokens`         | 6 h   | Deletes expired refresh / verification tokens (revoked ones are kept 30 days for reuse detection)                                                                 |

---

## Testing

```bash
npm test               # 149 tests
npm run test:coverage  # coverage/ html report
```

Integration tests run the real app with Supertest against `TEST_DATABASE_URL` (migrated, truncated and seeded once per
run). Cloudinary and SSLCommerz are mocked; emails are captured in memory. Concurrency is tested for double bookings,
double approvals and job locking.

---

## Deployment

### Docker

```bash
docker build -t pet-adoption-api .
docker run --env-file .env -p 5000:5000 pet-adoption-api      # runs `prisma migrate deploy`, then the API
docker run --env-file .env pet-adoption-api npm run db:seed:prod   # first deploy only
```

Or everything locally: `docker compose --profile app up --build`.

### Render / Railway / any VPS

- **Build:** `npm ci && npm run build`
- **Start:** `npm run start:prod`
- **Release / first deploy:** `npm run db:seed:prod`
- Health check path: `/health` · every response carries an `X-Request-Id` header (also in logs).

---

## Production checklist

- [ ] `NODE_ENV=production`, strong `JWT_ACCESS_SECRET`, changed super admin password
- [ ] HTTPS on the API (required for the cross-site refresh cookie) and the frontend origin in `CLIENT_URLS`
- [ ] Brevo sender domain verified, `EMAIL_DRY_RUN=false`
- [ ] Cloudinary keys set
- [ ] SSLCommerz live store (`SSLCOMMERZ_IS_LIVE=true`) and the IPN URL configured in the merchant panel
- [ ] `usd_exchange_rate`, contact info and `admin_notification_email` set via `PATCH /settings`
- [ ] Database backups enabled
- [ ] More than one instance? Move the permission / settings caches to Redis (jobs are already safe)
