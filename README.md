# Ticket Tout

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2, providing the `docker compose` CLI)

## Environment setup

Copy the example environment file and fill in the values as needed:

```bash
cp .env.example .env
```

`.env` must define the following variables (see `.env.example`):

| Variable | Description |
| --- | --- |
| `POSTGRES_USER` | Username for the Postgres database |
| `POSTGRES_PASSWORD` | Password for the Postgres database |
| `POSTGRES_DB` | Name of the Postgres database |
| `POSTGRES_PORT` | Port Postgres listens on and is exposed on (e.g. `5432`) |
| `DATABASE_URL` | Full Postgres connection string used by the app (e.g. `postgresql://postgres:postgres@db:5432/postgres?schema=public`) — the host must be `db`, the service name of the database container in `docker-compose.yml`, and the port must match `POSTGRES_PORT` |
| `JWT_SECRET` | Secret key used to sign/verify authentication JWTs |

## Running with Docker Compose

The stack is defined in `docker-compose.yml` and includes:

- `db`: a `postgres:18` container, always started, exposed on the port set by `POSTGRES_PORT`.
- `app-dev`: the app built from `./Ticket Tout` with the `dev-stage` Docker target, started only with the `dev` profile.
- `app-prod`: the app built from `./Ticket Tout` with the `prod-stage` Docker target, started only with the `prod` profile.

Only one of `app-dev` / `app-prod` runs at a time, depending on the profile you select. Both expose the app on port `3000`.

### Dev mode

```bash
docker compose --profile dev up --build
```

This builds and starts `db` and `app-dev`. The `./Ticket Tout` directory is bind-mounted into the container (with `node_modules` kept container-side), so local source changes are picked up for hot reload without rebuilding the image. The app is available at `http://localhost:3000` and Postgres at `localhost:${POSTGRES_PORT}`.

### Prod mode

```bash
docker compose --profile prod up --build
```

This builds and starts `db` and `app-prod` using the production Docker target (`npm run build`, then `npm start`). The app is available at `http://localhost:3000` and Postgres at `localhost:${POSTGRES_PORT}`.

### Stopping

```bash
docker compose down
```

This stops and removes the containers. The `data_sql` volume (Postgres data) persists across restarts unless removed explicitly with `docker compose down -v`.
