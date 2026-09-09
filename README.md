# CartePro

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2, providing the `docker compose` CLI)
- [mkcert](https://github.com/FiloSottile/mkcert) — only for the `prod` profile, which serves the app over HTTPS

## Environment setup

The stack uses **one environment file per profile** — there is no single `.env`:

| Profile | File | Used by |
| --- | --- | --- |
| `dev` | `.env.development` | `app-dev` |
| `prod` | `.env.production` | `app-prod` |

Create them from the template and fill in the values:

```bash
cp .env.example .env.development
cp .env.example .env.production
```

Both are ignored by git (`.gitignore` matches `.env*`), so real secrets never get committed.

### Why `--env-file` is required

The env file is consumed in **two different ways**, and only one of them is automatic:

1. `docker-compose.yml` declares `env_file:` on `app-dev` / `app-prod`, which injects the variables **into those containers**. This happens on its own.
2. The rest of the file uses `${VAR}` **interpolation** — `db`'s port mapping, `redis`'s `redis-server` command line, the `garage` tokens. Compose resolves those at parse time from `--env-file` (or a file literally named `.env`), *not* from `env_file:`.

Because this project has no `.env`, **every `docker compose` command must be given `--env-file`**. Omit it and compose falls back to blank strings, printing `The "POSTGRES_PORT" variable is not set. Defaulting to a blank string.` and starting Postgres and Redis with empty credentials.

```bash
docker compose --env-file .env.development --profile dev config   # verify: no "variable is not set" warnings
```

### Variables

| Variable | Description |
| --- | --- |
| `POSTGRES_USER` | Username for the Postgres database |
| `POSTGRES_PASSWORD` | Password for the Postgres database |
| `POSTGRES_DB` | Name of the Postgres database |
| `POSTGRES_PORT` | Port Postgres listens on and is exposed on (e.g. `5432`) |
| `DATABASE_URL` | Full Postgres connection string used by the app — the host must be `db` (the database service name in `docker-compose.yml`) and the port must match `POSTGRES_PORT` |
| `JWT_SECRET` | Secret key used to sign/verify authentication JWTs |
| `JWT_TTL_SECONDS` | JWT lifetime in seconds (e.g. `1800`) |
| `BETTER_AUTH_SECRET` | Secret used by Better Auth |
| `BETTER_AUTH_URL` | Public base URL of the app — `https://localhost:3000` in dev, `https://localhost` in prod (nginx terminates TLS on 443) |
| `ENABLE_DEMO_EMPLOYEE` | `true` to expose the demo employee endpoint |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis connection settings (host must be `redis`) |
| `REDIS_DATA_DIR` | In-container Redis data directory (e.g. `/data`), also the mount point of the `redis_data` volume |
| `REDIS_URL` | Full Redis connection string used by the app |
| `GARAGE_RPC_SECRET` / `GARAGE_ADMIN_TOKEN` / `GARAGE_METRICS_TOKEN` | Garage (S3-compatible storage) internal secrets |
| `GARAGE_DEFAULT_ACCESS_KEY` / `GARAGE_DEFAULT_SECRET_KEY` | S3 credentials the app uses against Garage |
| `GARAGE_DEFAULT_BUCKET` | Bucket holding uploaded documents (e.g. `kbis-documents`) |
| `APP_HOST_IP` | Optional. Local IP the prod HTTPS certificate is issued for; `dev/start-prod.sh` detects it automatically when unset |

## Running with Docker Compose

The stack is defined in `docker-compose.yml`:

- `db` — `postgres:18`, always started, exposed on `POSTGRES_PORT`.
- `redis` — `redis:7`, always started, password-protected, AOF persistence in the `redis_data` volume.
- `garage-config` / `garage` — S3-compatible object storage for uploaded documents; `garage-config` is a one-shot container that writes `garage/garage.toml` before `garage` starts.
- `app-dev` — the app built from `./CartePro` with the `dev-stage` target. Profile `dev` only.
- `app-prod` — the app built from `./CartePro` with the `prod-stage` target. Profile `prod` only.
- `nginx` — TLS termination and reverse proxy in front of `app-prod`. Profile `prod` only.

Only one of `app-dev` / `app-prod` runs at a time, depending on the selected profile.

### Dev mode

Use the helper script — like the prod one, it issues the HTTPS certificate before starting the stack:

```bash
./dev/start-dev.sh
```

Starts `db`, `redis`, `garage` and `app-dev`. The `./CartePro` directory is bind-mounted into the container (with `node_modules` kept container-side), so local source changes hot-reload without rebuilding the image.

There is no nginx in this profile: Next.js serves TLS itself (`next dev --experimental-https`) using the same certificate pair as prod.

The equivalent manual command, if you already have a certificate covering your current LAN IP:

```bash
docker compose --env-file .env.development --profile dev up --build
```

### Prod mode

Use the helper script — it handles the HTTPS certificate before starting the stack:

```bash
./dev/start-prod.sh
```

The script:

1. Checks that `mkcert` and `docker` are installed.
2. Determines this machine's LAN IP (`APP_HOST_IP` from the environment if set; otherwise auto-detected — `ipconfig getifaddr` on macOS, `hostname -I` on Linux). Override it when detection picks the wrong interface:
   ```bash
   APP_HOST_IP=192.168.1.42 ./dev/start-prod.sh
   ```
3. Generates a certificate if none is currently valid (see below).
4. Refuses to start if `.env.production` is missing or empty.
5. Runs `docker compose --env-file .env.production --profile prod up`.

Once up, the app is reachable at `https://localhost`. Port `80` redirects to `443`.

The equivalent manual command, if you already have valid certificates:

```bash
docker compose --env-file .env.production --profile prod up --build
```

#### HTTPS certificates

Both profiles share one certificate pair, issued by `dev/generate-certs.sh` (which `start-dev.sh` and `start-prod.sh` both source, and which you can also run on its own after switching networks):

```bash
./dev/generate-certs.sh
```

The `prod` profile puts nginx in front of `app-prod`, so it needs the certificate and private key as files:

| File | Mounted into nginx as |
| --- | --- |
| `CartePro/certificates/localhost.pem` | `/etc/ssl/certs/localhost.pem` |
| `CartePro/certificates/localhost-key.pem` | `/etc/ssl/private/localhost-key.pem` |


```bash
APP_HOST_IP=192.168.1.42 ./dev/start-dev.sh
```

The pair is regenerated when it is missing, expired, or does not cover the current LAN IP — so a certificate issued at a previous IP is replaced automatically rather than silently reused. **Your LAN IP changes when you move between networks**, so re-run the start script (or `./dev/generate-certs.sh`) after switching WiFi. To force a fresh one:

```bash
rm -rf "CartePro/certificates" && ./dev/start-dev.sh
```

`CartePro/certificates/` is gitignored — the private key must never be committed.

##### Trusting it on other devices

Other devices on the LAN see an untrusted-certificate warning, because they do not know this machine's mkcert CA. Either accept the warning, or install the CA for a clean padlock — copy `rootCA.pem` from the directory `mkcert -CAROOT` prints:

| Device | How |
| --- | --- |
| Android | Settings → Security → Encryption & credentials → Install a certificate → CA certificate |
| iOS | AirDrop/email the file, install the profile, then Settings → General → About → Certificate Trust Settings → enable it |
| Another Linux/macOS machine | Install mkcert there, copy `rootCA.pem` and `rootCA-key.pem` into its own `mkcert -CAROOT`, then `mkcert -install` |

Prefer installing the CA when testing the QR scanner: a browser that had to be argued past a certificate warning can still refuse camera access.

nginx's configuration lives in `nginx/nginx.conf` (mounted read-only); it redirects `:80` to `:443` and proxies HTTPS traffic to `app-prod:3000`, forwarding WebSocket upgrade headers.

### Stopping

To stop the stack while keeping data, pass the same `--env-file` you started with:

```bash
docker compose --env-file .env.development --profile dev down    # dev
docker compose --env-file .env.production --profile prod down    # prod
```

Named volumes (`data_sql`, `redis_data`, `garage_meta`, `garage_data`) survive this, so the database keeps its rows across restarts.

#### Full purge

`dev/stop-docker.sh` wipes the project entirely — containers, **images**, **volumes** and orphans, across every profile. It takes the env file as its only argument and asks for confirmation before doing anything:

```bash
./dev/stop-docker.sh .env.production
```

It runs `docker compose --env-file <file> --profile '*' down --rmi all --volumes --remove-orphans`.

> **This deletes your database, Redis data and Garage buckets.** Use plain `docker compose down` unless you really want a clean slate; after a purge the next start re-downloads/rebuilds images and the database comes back empty (re-seed it with `./dev/seed-db.sh`).

## Seeding the database

A deterministic seed (50 employees with varied balances, 6 partners
(`isPartner = true`) across 6 categories, 12 employer companies
(`isPartner = false`) the employees are attached to through `users.companyId`,
and 200 payment/refund transactions spread over 90 days, plus the employer
top-ups that fund them) can be loaded once the dev stack is up:

```bash
cd "CartePro" && npm run db:seed:generate   # regenerates mocks/seed.sql, mocks/transactions.csv, mocks/justificatif.md
cd .. && ./dev/seed-db.sh mocks/seed.sql {container_app_name} {container_db_name}                      # applies pending migrations, then loads mocks/seed.sql
```

`mocks/seed.sql` is committed, so `dev/seed-db.sh` can be run directly against
a fresh database without regenerating it first. `npm run db:seed:generate` is
fully deterministic (fixed random seed and reference date) — running it again
on an empty database reproduces the exact same ids, amounts, and dates, so
`mocks/seed.sql` and `mocks/transactions.csv` always match. Every generated
statement carries `ON CONFLICT DO NOTHING`, so re-applying `mocks/seed.sql` to an
already seeded database is a no-op instead of a unique-violation. The seed only
ever `INSERT`s rows in chronological order (never `UPDATE`s a transaction to
fix a balance).

Seeded salariés are created with `accountStatus = 'ACCEPTED'`, so they can log in
straight away (`<prenom>.<nom><n>@example.fr` / `Secret123!`).
