# Tests

## Backend

This folder contains the tests for the CartePro application. The tests are written in TypeScript and use the Jest testing framework for unit and integration testing of the API. Jest runs in native ESM mode (`node --experimental-vm-modules`, see the `test` script in `package.json`) rather than through `next/jest`, since the tests import route handlers and services directly instead of going through the Next.js dev/prod server.

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

No database or Docker stack needs to be running — the suite is fully mocked (see above), and no environment variable has to be exported:

```sh
npm run test
# or: npm run ci:test:backend:unit
```

This invokes `node --experimental-vm-modules node_modules/.bin/jest` (see `jest.config.ts` for the Jest configuration, including `testMatch: ['<rootDir>/tests/**/*.test.ts']`).

`lib/services/auth_service.ts` signs and verifies tokens with `JWT_SECRET`, and the tests exercise real login/authorization flows, so the variable must be set — with an empty one, every test going through `authorize`/`signToken` fails with `DataError: Zero-length key is not supported`. `setup-env.ts`, wired in through `setupFiles`, defaults it to a throwaway test value; it runs before any module is imported, because `auth_service` reads the secret at load time. A value already present in the environment is left alone, so the suite still runs against the real secret under `docker compose --profile dev up`.

## Frontend

No frontend tests exist yet.
