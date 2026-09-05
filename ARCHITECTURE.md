## Stack overview

- **Next.js** (v16.3.3, App Router) — TypeScript framework used for both the frontend UI and the backend API routes of the main application (`app/`).
- **React** (v19.2.8) with **Tailwind CSS v4** and **shadcn** components for UI.
- **PostgreSQL 18** — relational database, run from the official `postgres:18` Docker image (no custom database Dockerfile).
- **Prisma** — intended ORM for the service layer to access PostgreSQL. The Dockerfile already runs `npx prisma migrate deploy` on build.
- **Docker** / **Docker Compose** — containerization and multi-service orchestration for local development and production.

## Backend architecture in 2 layers

The `app` service follows a 2-layer architecture:

1. **Handler layer** (`app/app/api/`): Next.js Route Handlers that receive HTTP requests, validate input, and delegate to the service layer. Currently present as an empty `api/` directory with no route implementations yet.
2. **Service layer** (`app/lib/services/`): business logic that uses Prisma to talk to the PostgreSQL database.

## Project tree

```
.
├── app                      # Next.js application (frontend + backend API)
│   ├── Dockerfile           # Multi-stage Dockerfile (base -> dev-stage / prod-stage)
│   ├── app
│   │   ├── api/             # Route handlers
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── favicon.ico
│   ├── public               # Static assets
│   ├── package.json
│   └── ...                  # Next.js/TypeScript/ESLint config files
├── docker-compose.yml       # Orchestrates the db, app-dev and app-prod services
└── .env.example             # Example environment variables
```

Notes on the tree above:
- There is no `db/` directory anymore: the `db` service in `docker-compose.yml` uses the official `postgres:18` image directly, with no custom Dockerfile or seed script. Filled by the `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` env vars in `.env`.

## Docker Compose services

| Service | Image / Build | Notes |
| --- | --- | --- |
| `db` | `postgres:18` (official image) | Exposes port 5432, persists data in the `data_sql` volume, configured via `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` env vars |
| `app-dev` | Built from `./app`, target `dev-stage` | Runs under the `dev` Compose profile, mounts source with a volume for hot reload, exposes port 3000 |
| `app-prod` | Built from `./app`, target `prod-stage` | Runs under the `prod` Compose profile, runs the production build, exposes port 3000 |

The `app/Dockerfile` is multi-stage: a shared `base` stage (Node `26.1.0-bookworm-slim`, `npm ci`) followed by `dev-stage` (`npm run dev`) and `prod-stage` (`npm run build` + `npm start`). Both stages run `npx prisma migrate deploy` at build time.

## Technical choices

| Choice | Description |
| --- | --- |
| Next.js | Framework for building the frontend and backend of the application in TypeScript |
| React 19 / Tailwind CSS v4 / shadcn | UI layer of the Next.js application |
| PostgreSQL | Relational database management system with extensive features, run from the official `postgres:18` image |
| Prisma | ORM written in TypeScript, used by the service layer to access PostgreSQL |
| Docker | Containerization platform |
| Docker Compose | Tool for defining and running multi-container Docker applications, with `dev` and `prod` profiles for the `app` service |
