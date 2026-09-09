# Stack overview

- **Next.js** (v16, App Router) — TypeScript framework used for both the frontend UI and the backend API routes of the main application, which lives entirely under `CartePro/`.
- **React 19** with **Tailwind CSS v4** and **shadcn** components for UI (`CartePro/components/`), plus **Leaflet** for the partner map and **next-themes** for light/dark mode.
- **PostgreSQL 18 + PostGIS** — relational database, run from the `postgis/postgis:18-3.6` image. PostGIS backs the geographic search for partners.
- **Prisma Next** (`@prisma/orm-postgres` v8, with `@prisma/orm-extension-postgis`) — data access layer. This is *not* the classic Prisma Client; see "Data access" below.
- **Redis 7** — cache and short-lived state (payment QR codes, ban list).
- **Garage** (`dxflrs/garage`) — self-hosted S3-compatible object storage for uploaded documents (KBIS, employee justificatifs), accessed through the AWS S3 SDK.
- **Brevo** — transactional email provider (`@getbrevo/brevo`).
- **Docker** / **Docker Compose** — containerization and multi-service orchestration, with `dev` and `prod` profiles.
- **Jest** for unit tests, **k6** for load tests.

# Backend architecture in 2 layers

The application follows a 2-layer backend architecture, colocated with the frontend in a single Next.js app:

1. **Handler layer** (`CartePro/app/api/v1/**/route.ts`): Next.js Route Handlers that receive HTTP requests, validate and sanitize input with **zod** schemas, enforce authorization, and delegate to the service layer. Every handler carries an `@openapi` JSDoc block, surfaced as Swagger UI on the `/docs` page via `next-swagger-doc`.
2. **Service layer** (`CartePro/lib/services/`): business logic, one file per domain concern — `auth_service`, `company_service`, `qrcode_service`, `professional_signup_service`, `ownership_service`, `email_service`, `garage_service`, `redis_service`, `error_service`, `s3_client`, `postgres_client`.

**Authentication and authorization.** Login issues a JWT (`jose`, HS256) stored in the `ticket_tout_token` cookie. `CartePro/proxy.ts` gates page routes per role and redirects to the role's home (`/` employee, `/employer` company, `/partner` partner, `/admin` admin). API routes are gated by `lib/roles-config.ts`, a single map from `METHOD /path` to the allowed roles — extend it whenever a protected handler is added. Roles are `ADMIN`, `COMPANY`, `PARTNER`, `EMPLOYEE`.

**Data access is "Prisma Next", not classic Prisma Client.** The schema (the "data contract") lives at `CartePro/prisma/contract.prisma`. Editing it requires regenerating two committed files — `prisma/contract.json` (lockfile-like) and `prisma/contract.d.ts` (types) — with `npm run db:generate` (`prisma contract emit`); commit them alongside the contract change. The typed client is imported as `import { db } from '@/lib/prisma/db'` and queried like `db.orm.public.User.where({ ... }).first()`. Migrations live in `CartePro/migrations/` (`app/` and `postgis/` spaces, plus `snapshots/`) and are applied with `npm run db:migrate`. Full reference: `CartePro/prisma-next.md`.

**Domain model** (`prisma/contract.prisma`): `Users` (with `Role` and `AccountStatus`), `Company` (employers and partners, with `CompanyCategory` and `CompanyValidationReason`), `AdminUser`, `Document` (KBIS and user justificatifs), `Transaction` (`TransactionType` = `TOPUP` / `PAYMENT` / `REFUND`, `TransactionStatus`), `QrCode`, `BannedUser`, `UserRefusalReason`. Transactions are never edited or deleted — corrections go through compensating reversal transactions.

# Project tree

```
.
├── CartePro                    # Next.js application (frontend + backend API)
│   ├── Dockerfile              # Multi-stage (base -> dev-stage / prod-stage)
│   ├── docker-entrypoint.sh    # Runs db:migrate, then the CMD
│   ├── app
│   │   ├── api/v1/             # Route handlers (login, signup, me, salaries,
│   │   │                       #  employeurs, partenaires, qrcode, admin, ...)
│   │   ├── health/route.ts     # Healthcheck endpoint
│   │   ├── docs/               # Swagger UI page
│   │   ├── page.tsx            # Employee space (balance, partners, payment QR)
│   │   ├── login/ signup/ profile/ transactions/ partners/
│   │   ├── employer/ partner/ admin/          # Role-specific spaces
│   │   ├── mentions-legales/ politique-confidentialite/ conditions-generales/
│   │   ├── layout.tsx  globals.css  palette.css
│   │   └── error.tsx  not-found.tsx
│   ├── components/             # UI components + shadcn primitives in ui/
│   ├── hooks/                  # React hooks (e.g. use-current-user)
│   ├── lib
│   │   ├── services/           # Service layer (business logic)
│   │   ├── prisma/db.ts        # Typed Prisma Next client
│   │   ├── roles-config.ts     # METHOD /path -> allowed roles
│   │   └── api-client.ts  brand.ts  swagger.ts  pagination.ts  utils.ts
│   ├── prisma/                 # contract.prisma + generated contract.json/.d.ts
│   ├── migrations/             # app/ and postgis/ migration spaces, snapshots/
│   ├── proxy.ts                # Role-based page routing guard
│   ├── tests/                  # api/ (Jest unit tests), mocks/, k6/ (load tests)
│   ├── certificates/           # Local HTTPS cert for next dev
│   └── dev/generate-seed.ts    # Regenerates mocks/seed.sql
├── docker-compose.yml          # db, app-dev, app-prod, nginx, redis, garage
├── nginx/nginx.conf            # TLS reverse proxy in front of app-prod
├── garage-init/                # Builds the Garage config image
├── mocks/                      # seed.sql, seed-roles.sql, test credentials
├── docs/                       # API.md (spec), API_SUMMARY.md, deployment notes
├── dev/                        # BRANCHES.md, COMMIT.md, helper shell scripts
└── .env.example                # Example environment variables
```

Notes on the tree above:
- There is no `db/` directory: the `db` service uses the `postgis/postgis:18-3.6` image directly. Schema creation is handled by `npm run db:migrate` (run by `docker-entrypoint.sh` in prod), and sample data by the SQL files in `mocks/`.
- `CartePro/AGENTS.md` is generated by `next dev` — do not hand-edit it.

# Docker Compose services

| Service | Image / Build | Notes |
| --- | --- | --- |
| `db` | `postgis/postgis:18-3.6` | PostgreSQL 18 with PostGIS. Port and credentials from `POSTGRES_*`, data persisted in the `data_sql` volume |
| `app-dev` | Built from `./CartePro`, target `dev-stage` | `dev` profile. Bind-mounts `./CartePro` for hot reload, reads `.env.development`, serves **HTTPS** on port 3000 using `CartePro/certificates/` |
| `app-prod` | `ghcr.io/theo-futol/survivor:${RELEASE_TAG}`, built from `./CartePro`, target `prod-stage` | `prod` profile. Reads `.env.production`, runs the standalone build on port 3000 |
| `nginx` | `nginx:alpine` | `prod` profile. TLS termination on 80/443 in front of `app-prod` |
| `redis` | `redis:7` | Password-protected, AOF persistence, 64 MB cap with `noeviction`, `redis_data` volume |
| `garage-config` | Built from `./garage-init` | One-shot job that writes `garage/garage.toml`; `garage` waits for it to complete successfully |
| `garage` | `dxflrs/garage:v2.3.0` | Single-node S3 storage. Exposes 3900 (S3 API), 3901 (RPC), 3902 (web), 3903 (admin); `garage_meta` / `garage_data` volumes |

`CartePro/Dockerfile` is multi-stage: a shared `base` stage (Node `26.1.0-bookworm-slim`, `npm ci`), then `dev-stage` (runs `db:generate`, then `npm run dev`) and `prod-stage` (runs `npm run build`, which itself runs `db:generate`, and starts the standalone server). Only `prod-stage` applies migrations, via `docker-entrypoint.sh`.

Environment variables are grouped as `POSTGRES_*` / `DATABASE_URL`, `JWT_SECRET` / `JWT_TTL_SECONDS`, `REDIS_*`, `GARAGE_*`, `BREVO_API_KEY`, `APP_BASE_URL` and `ENABLE_DEMO_EMPLOYEE`. `DATABASE_URL`'s host must be `db` (the Compose service name) and its port must match `POSTGRES_PORT`.

# Running the stack

```bash
cp .env.example .env.development             # first time only, then fill in the values
docker compose --env-file .env.development --profile dev up --build
docker compose --profile prod up --build     # production profile (adds nginx)
docker compose down                          # add -v to also drop the volumes
```

The dev app is served over HTTPS with a self-signed certificate: <https://localhost:3000>.

App-level commands run from `CartePro/` (or inside the container):

```bash
npm run dev            # next dev over HTTPS
npm run build          # db:generate + next build (standalone output)
npm run db:generate    # regenerate contract.json / contract.d.ts
npm run db:migrate     # apply migrations
npm run db:verify      # check the database against the contract
npm run db:seed:generate  # regenerate mocks/seed.sql
npm test               # Jest unit tests (tests/api)
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run brand:check    # brand consistency check
```

Sample data is loaded with `docker exec -i cartepro_db psql -U postgres -d cartepro < mocks/seed.sql`, then `mocks/seed-roles.sql` (which must run second). Test accounts, one per role, are documented in `mocks/login.txt`.

# Testing and CI

- **Unit tests**: Jest (`tests/api/`), one test file per route handler, with fixtures in `tests/mocks/`. `npm run ci:test:backend:unit` is the CI entry point.
- **Load tests**: k6 scenarios in `tests/k6/` (`smoke.js`, `average-load.js`, `stress.js`, `scenario.js`).
- **Workflows**: `.github/workflows/` holds `ci.yml`, `deploy.yml` and `mirror.yml`. Production images are published to `ghcr.io/theo-futol/survivor`.

# Technical choices

| Choice | Description |
| --- | --- |
| Next.js | Framework for building the frontend and backend of the application in TypeScript, single deployable unit |
| React 19 / Tailwind CSS v4 / shadcn | UI layer of the Next.js application |
| Leaflet | Interactive map for locating partners |
| PostgreSQL + PostGIS | Relational database, with geographic types and indexes for partner proximity search |
| Prisma Next (`@prisma/orm-postgres`) | Typed data access generated from a committed data contract rather than a runtime schema |
| Redis | Cache and short-lived state: payment QR codes (5-minute TTL) and the ban list |
| Garage (S3) | Self-hosted object storage for uploaded documents, kept out of the relational database |
| jose (JWT) + zod | Stateless auth tokens, and schema validation of every request payload |
| Brevo | Transactional email delivery |
| Docker / Docker Compose | Containerization and multi-container orchestration, with `dev` and `prod` profiles |
| nginx | TLS termination and reverse proxy in front of the production app |
| Jest / k6 | Unit tests per route handler, and load testing |
