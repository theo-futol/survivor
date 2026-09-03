# Tests

## Backend

This folder contains the tests for the Ticket Tout application. The tests are written in TypeScript and use the Jest testing framework for unit and integration testing of the API. Jest runs in native ESM mode (`node --experimental-vm-modules`, see the `test` script in `package.json`) rather than through `next/jest`, since the tests import route handlers and services directly instead of going through the Next.js dev/prod server.

### Layout

- `mocks/` — in-memory mock of `@/lib/prisma/db` (`mock-db.ts`) and the fixture data it seeds from (`fixtures.ts`). Wired in globally via `jest.config.ts`'s `moduleNameMapper`, so any route/service importing `@/lib/prisma/db` transparently gets the mock — no real database is needed to run the suite.
- `api/` — integration tests for the API route handlers.

### Mock fixtures

`mocks/fixtures.ts` defines the rows the suites below assume exist. Each test file calls `resetMockDb()` (from `mocks/mock-db.ts`) in a `beforeEach` to restore this state before every test, so tests don't leak data into one another:

- `test-login@example.com` / `Secret123!` (exported as `SEED_PASSWORD`) — role `COMPANY`, id `user-test-1`.
- `test-salarie@example.com` / `Secret123!` — role `EMPLOYEE`, id `user-test-2`.
- A partner company, id `company-test-1` (`Test Partner`), used as the target of the qrcode tests.

The mock only implements the two operations the app currently performs (`.where(condition).first()` and `.create(data)`). If a route starts using another Prisma Next operation (e.g. `.update()`, pagination, relations), extend `mocks/mock-db.ts` accordingly.

### Running the tests

No database or Docker stack needs to be running — the suite is fully mocked (see above). You do need `JWT_SECRET` set in the environment, since `lib/services/auth_service.ts` signs/verifies tokens with it and the tests exercise real login/authorization flows; when running via `docker compose --profile dev up`, this is already injected from the root `.env` (see `docker-compose.yml`), but running directly on the host requires exporting it yourself:

```sh
export JWT_SECRET=any-non-empty-value
npm run test
# or: npm run ci:test:backend:unit
```

This invokes `node --experimental-vm-modules node_modules/.bin/jest` (see `jest.config.ts` for the Jest configuration, including `testMatch: ['<rootDir>/tests/**/*.test.ts']`). Without `JWT_SECRET`, every test that goes through `authorize`/`signToken` fails with `DataError: Zero-length key is not supported`.

## Frontend

No frontend tests exist yet.
