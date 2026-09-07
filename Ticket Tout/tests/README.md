# Tests

## Backend

This folder contains the tests for the Ticket Tout application. The tests are written in TypeScript and use the Jest testing framework for unit and integration testing of the API. Jest runs in native ESM mode (`node --experimental-vm-modules`, see the `test` script in `package.json`) rather than through `next/jest`, since the tests import route handlers and services directly instead of going through the Next.js dev/prod server.

### Layout

- `mocks/` — in-memory mocks wired in globally via `jest.config.ts`'s `moduleNameMapper`, so any route/service importing them transparently gets the mock and no real database, Redis or Postgres connection is needed:
  - `mock-db.ts` — stands in for `@/lib/prisma/db`.
  - `mock-redis.ts` — stands in for `@/lib/services/redis_service` (the ban store).
  - `mock-postgres.ts` — stands in for `@/lib/services/postgres_client`, i.e. the raw `withTransaction` lane.
  - `fixtures.ts` — the seed rows every mock starts from.
- `api/` — integration tests for the API route handlers.

### Mock fixtures

`mocks/fixtures.ts` defines the rows the suites below assume exist. Each test file calls `resetMockDb()` (from `mocks/mock-db.ts`) in a `beforeEach` to restore this state before every test, so tests don't leak data into one another; suites that ban users also call `resetMockRedis()` (from `mocks/mock-redis.ts`).

Two legacy rows are kept for the login and qrcode suites, which predate UUID validation:

- `test-login@example.com` / `Secret123!` (exported as `SEED_PASSWORD`) — role `COMPANY`, id `user-test-1`.
- `test-salarie@example.com` / `Secret123!` — role `EMPLOYEE`, id `user-test-2`.
- A partner company, id `company-test-1` (`Test Partner`), used as the target of the qrcode tests.

Every other route validates its path params and body ids with `z.uuid()`, so the rows those suites act on use real UUIDs exported as named constants (`ADMIN_ID`, `COMPANY_USER_ID`, `EMPLOYEE_ID`, `PARTNER_USER_ID`, `EMPLOYER_COMPANY_ID`, `PARTNER_COMPANY_ID`, `OTHER_COMPANY_ID`, `UNKNOWN_ID`, …). Import the constant rather than hard-coding a UUID. The employee belongs to `EMPLOYER_COMPANY_ID` and already has two transactions, which is what the salariés-list aggregates assert against.

### What the mocks support

`mock-db.ts` is a small query engine over plain arrays, covering the operations the routes actually use: `.where()` with either an equality object or a field-proxy lambda (`.eq`, `.neq`, `.lt/.lte/.gt/.gte`, `.in`, `.like/.ilike`, `.isNull/.isNotNull`), `.select()`, `.orderBy()`, `.limit()`, `.offset()`, `.include()`, `.aggregate()` (`count`/`sum`/`avg`/`min`/`max`), `.all()`, `.first()`, `.create()`, `.update()` and `.delete()`. Relations available to `.include()` are declared in the `RELATIONS` map at the top of the file — add an entry there when a route eager-loads a new relation.

`mock-postgres.ts` deliberately understands only the raw statements the routes actually issue and throws on anything else, so a newly added raw query fails loudly instead of silently doing nothing. Currently supported: the abondement route's `SELECT id … FOR UPDATE` and batched `UPDATE … balance = balance + $1`, and the transactions route's `SELECT balance … FOR UPDATE` and absolute `UPDATE … balance = $1`. Add a branch there when a route starts issuing new SQL.

### Running the tests

No database or Docker stack needs to be running — the suite is fully mocked (see above). You do need `JWT_SECRET` set in the environment, since `lib/services/auth_service.ts` signs/verifies tokens with it and the tests exercise real login/authorization flows; when running via `docker compose --profile dev up`, this is already injected from the root `.env` (see `docker-compose.yml`), but running directly on the host requires exporting it yourself:

```sh
export JWT_SECRET=any-non-empty-value
npm run test
# or: npm run ci:test:backend:unit
```

This invokes `node --experimental-vm-modules node_modules/.bin/jest` (see `jest.config.ts` for the Jest configuration, including `testMatch: ['<rootDir>/tests/**/*.test.ts']`). Without `JWT_SECRET`, every test that goes through `authorize`/`signToken` fails with `DataError: Zero-length key is not supported`.

### Live stack tests

`double-encaissement.sh` is the one test that does **not** run under Jest: it needs a real Postgres and a real HTTP server, because the behaviour it checks — the `SELECT balance … FOR UPDATE` row lock in `POST /api/v1/salaries/:salarieId/transactions` — is exactly what `mocks/mock-postgres.ts` stands in for. It is not part of `npm run test`; run it explicitly, from the repo root:

```sh
./"Ticket Tout"/tests/double-encaissement.sh
ROUNDS=20 AMOUNT=500 ./"Ticket Tout"/tests/double-encaissement.sh   # races are probabilistic
```

Env knobs: `BASE_URL` (default `http://localhost:3000`), `AMOUNT` (`1000`), `ROUNDS` (`1`), `KEEP_STACK=1` to skip the teardown, `CONFIRM=0` (or `--yes`) to skip the two interactive confirmations. A non-tty stdin implies `CONFIRM=0`, so the script never hangs unattended.

What it does: brings up the `dev` profile (`docker compose --env-file .env.development --profile dev up -d --build`), waits for `pg_isready` and `GET /health`, seeds through `dev/seed-db.sh` with `mocks/seed.sql` then `mocks/seed-roles.sql`, logs in as the seeded `PARTNER` (`mocks/login.txt` — `PARTNER` is one of the roles allowed to POST this route, and POST runs no ownership check), forces the seeded employee's balance to exactly `AMOUNT` and clears their transaction rows, then releases **2 threads × 2 concurrent payments** of `AMOUNT` through a start gate. Only one of the four may win.

It asserts, per round: 4 × `201`; a final balance of exactly `0` — a negative one is the double encaissement and means the lock was bypassed; exactly 1 `VALIDER` and 3 `REFUSER` `transaction` rows (4 in total); the accepted row recording `newBalance` `0`; and no row recording a negative `newBalance`. The stack is torn down (`compose down`, volumes kept) on exit.

The assertions run against the database rather than the HTTP status on purpose: on insufficient balance the route **persists a `REFUSER` row and answers `201`**, not the `400` `docs/API.md` describes. Refused attempts do leave rows behind — that is current behaviour, not a bug the script tests for.

#### Known blockers (the script currently FAILs)

Running this script against `backend` as it stands reports `FAIL`, and both causes are in the application, not the test:

1. **Every `PAYMENT` POST returns 500.** The database carries a check constraint `transaction_type_matches_company` — `CHECK ((type = 'TOPUP' AND "companyId" IS NULL) OR (type <> 'TOPUP' AND "companyId" IS NOT NULL))` — but `POST /api/v1/salaries/:salarieId/transactions` never sets `companyId` on the row it creates. `TOPUP` succeeds, every other type fails on insert. Until the route sets `companyId`, the overdraft path cannot be exercised at all.
2. **The failed insert leaves the money gone.** The debit is committed by `withTransaction` *before* `db.orm.public.Transaction.create()` runs, so when the insert fails the balance has already dropped (1000 → 0 in the run above) with **no** transaction row to show for it. The debit and the audit row need to be in one transaction.

A third, milder issue shapes the script: `lib/services/redis_service.ts` guards its connection with a plain `redisConnected` boolean, so a cold burst of concurrent requests all call `redisClient.connect()` at once and `authorize()` answers `503`. The script works around it with a single warm-up request, which must target *this* route — `next dev` compiles a bundle per route, so each handler holds its own `redis_service` instance.

Two things to know: every statement in both seed files is `ON CONFLICT DO NOTHING`, so re-seeding the surviving `data_sql` volume is safe and the script always does it; and the test employee is left at balance `0` with 4 transaction rows, so re-seed a fresh volume (`compose down -v`) if you want the seeded `5000` back.

## Frontend

No frontend tests exist yet.
