# API_SUMMARY

What was actually built on the backend, as opposed to `API.md`, which describes the intent.
Where the two disagree, **this document describes the shipped behaviour** and says why.

## Scope

Implemented here: Employers, Abondements, Employees (salariés), Partners, Admin ban.

Explicitly **not** in this scope, owned by others:

- everything under `## Transactions` in `API.md` (`GET`/`POST /salaries/{salarieId}/transactions`,
  `GET /partenaires/{partenaireId}/transactions`)
- the SIRH endpoint `GET /employees/{id}/balance`
- document upload — there is no endpoint anywhere in the repo, and `Company.kbisId` is still
  non-null (see *Known gaps*). `Users.documentId` no longer exists, so creating a salarié no
  longer needs one.

## Endpoints

All routes require `Authorization: Bearer <token>`. The role column is the coarse gate from
`CartePro/lib/roles-config.ts`; the *Extra rule* column is enforced inside the handler.

| Method & path | Roles | Extra rule | OK | File |
|---|---|---|---|---|
| `GET /api/v1/employeurs` | ADMIN, COMPANY | COMPANY sees only its own company | 200 | `app/api/v1/employeurs/route.ts` |
| `POST /api/v1/employeurs` | ADMIN | — | 201 | `app/api/v1/employeurs/route.ts` |
| `PATCH /api/v1/employeurs/{employeurId}` | ADMIN, COMPANY | COMPANY: own only | 200 | `app/api/v1/employeurs/[employeurId]/route.ts` |
| `DELETE /api/v1/employeurs/{employeurId}` | ADMIN | — | 204 | `app/api/v1/employeurs/[employeurId]/route.ts` |
| `POST /api/v1/employeurs/{employeurId}/abondements` | ADMIN, COMPANY | COMPANY: own only | 201 | `app/api/v1/employeurs/[employeurId]/abondements/route.ts` |
| `GET /api/v1/salaries` | ADMIN, COMPANY | COMPANY pinned to its own employees | 200 | `app/api/v1/salaries/route.ts` |
| `POST /api/v1/salaries` | ADMIN, COMPANY | COMPANY: own company only | 201 | `app/api/v1/salaries/route.ts` |
| `PATCH /api/v1/salaries/{salarieId}` | ADMIN, COMPANY, EMPLOYEE | COMPANY: own employees; EMPLOYEE: self, reduced field set | 200 | `app/api/v1/salaries/[salarieId]/route.ts` |
| `DELETE /api/v1/salaries/{salarieId}` | ADMIN, COMPANY | COMPANY: own employees | 204 | `app/api/v1/salaries/[salarieId]/route.ts` |
| `GET /api/v1/partenaires` | ADMIN, PARTNER | PARTNER sees only its own profile | 200 | `app/api/v1/partenaires/route.ts` |
| `POST /api/v1/partenaires` | ADMIN | — | 201 | `app/api/v1/partenaires/route.ts` |
| `PATCH /api/v1/partenaires/{partenaireId}` | ADMIN, PARTNER | PARTNER: own only | 200 | `app/api/v1/partenaires/[partenaireId]/route.ts` |
| `DELETE /api/v1/partenaires/{partenaireId}` | ADMIN | — | 204 | `app/api/v1/partenaires/[partenaireId]/route.ts` |
| `POST /api/v1/admin/ban` | ADMIN | — | 200 | `app/api/v1/admin/ban/route.ts` |
| `GET /api/v1/employees/{id}/balance` | ADMIN, COMPANY, EMPLOYEE | COMPANY: own employees; EMPLOYEE: self | 200 | `app/api/v1/employees/[id]/balance/route.ts` |
| `GET /api/v1/admin/transactions.csv` | ADMIN | — | 200 | `app/api/v1/admin/transactions.csv/route.ts` |
| `GET /api/v1/salaries/{salarieId}/transactions` | ADMIN, COMPANY, EMPLOYEE | COMPANY: own employees; EMPLOYEE: self | 200 | `app/api/v1/salaries/[salarieId]/transactions/route.ts` |
| `POST /api/v1/salaries/{salarieId}/transactions` | ADMIN, COMPANY, PARTNER | — | 201 | `app/api/v1/salaries/[salarieId]/transactions/route.ts` |

Employers and partners are the **same `Company` table**, told apart by `isPartner`
(`false` = employeur, `true` = partenaire). Asking for an employer by a partner's id returns
`404`, and vice versa.

## Deltas from API.md

The bodies in `API.md` are illustrative; the shipped schemas are derived from the columns the
database actually requires.

| API.md says | Shipped | Why |
|---|---|---|
| `POST /employeurs` body is `{name, email, siret, address}` | also requires `postalCode`, `kbisId`, `agentId`, `reasonId`, `categoryId`, `location` | all are non-null columns on `Company` |
| `POST /salaries` body has `numeroSalarie` | not accepted | no such column exists |
| `POST /salaries` has `nom` / `prenom` | `surname` / `name` | the column names |
| `POST /salaries` has `employeurId` | `companyId` | the column name |
| `POST /salaries` body is loosely matched | body is **strict**: any unknown field is a `400` | `accountStatus`, `documentId` and `numeroSalarie` are now refused explicitly rather than ignored |
| `POST /salaries` "generates a temporary password" | the password comes from the request body, chosen by the employer | `hashPassword` is a one-way SHA-256, so a generated password could never be disclosed at verification time; the employer communicates it out of band instead |
| `PATCH` verification "provides the temporary password unencrypted" | mails a validation notice with a link to the app, never a password | the salarié already holds the password their employer gave them |
| `POST /login` checks only the credentials | also `403` unless `accountStatus` is `ACCEPTED` | valid credentials now exist from creation, so verification is what must gate the account |
| Abondement body `{montant, date, type, comment}` | all validated; only `montant` is persisted | no columns exist for `type` / `comment` |
| `DELETE` employer "may return 409 if referenced" | always soft-deletes, never 409 | transactions are immutable, so the row must survive |

### Request bodies as shipped

**`POST /api/v1/employeurs`, `POST /api/v1/partenaires`**

```json
{
  "name": "Entreprise SA",
  "email": "contact@ex.com",
  "siret": "12345678901234",
  "kbisId": "uuid-of-an-existing-Document",
  "address": "1 rue A",
  "postalCode": "75001",
  "agentId": 1,
  "reasonId": 1,
  "categoryId": 1,
  "location": { "lat": 48.85, "lng": 2.35 },
  "verified": false,
  "isFeatured": false
}
```

`verified` and `isFeatured` are optional and default to `false`. `isPartner` and `active` are set
by the server and are rejected if supplied. `PATCH` takes any non-empty subset of the same fields.

**`POST /api/v1/salaries`**

```json
{
  "email": "j.dupont@ex.com",
  "surname": "Dupont",
  "name": "Jean",
  "companyId": "uuid-of-the-employer"
}
```

The body is strict: any other key — `accountStatus`, `documentId`, `numeroSalarie` — is a `400`.
`password` is required and must satisfy the complexity rules (8–32 chars, upper, lower, digit,
special); it is stored hashed and never returned. `role` is forced to `EMPLOYEE`, `balance` to `0`
and `accountStatus` to `PENDING`.

`PATCH` accepts `email`, `surname`, `name`, `password` and `accountStatus` — but a salarié
editing themselves is restricted to `surname`, `name`, `password`, and anything else is a `400`.

**`POST .../abondements`** — `{ "montant": 5000, "date": "2026-09-01", "type": "fixe", "comment": "…" }`
(`montant` a positive integer, `type` one of `fixe` | `variable`).

**`POST /api/v1/admin/ban`** — `{ "userId": "<uuid>", "reason": "Violation of terms" }`.


### Response shapes

List endpoints return the documented envelope:

```json
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 123 } }
```

`page` defaults to 1, `limit` to 20 and is capped at 100; anything outside that is a `400`.

`GET /api/v1/salaries` enriches each row beyond the raw columns:

```json
{
  "id": "…", "email": "…", "surname": "…", "name": "…",
  "balance": 6000, "companyId": "…", "createdAt": "…",
  "isBanned": false, "transactionCount": 3, "transactionTotal": 5500
}
```

`GET /api/v1/partenaires` includes the company category as a nested
`"category": { "id": 1, "category": "Restauration" }`.


Ban returns `{ "status": "banned", "userId", "reason" }`; favorites return
`{ "status": "added" | "removed", "partnerId" }`; abondement returns
`{ "montant", "salariesCredites", "montantTotal" }`.

## Behaviour notes

**Soft deletes.** Nothing is ever physically removed, because transactions are immutable and
reference both sides. Deleting an employer or partner sets `Company.active = false`; deleting a
salarié dates `Users.expiredAt`. Both then disappear from every read (list endpoints filter on
`active = true` / `expiredAt IS NULL`), and a second delete of the same row returns `404`.

**Abondement.** One call credits **every** active employee of the company — the body carries no
`salarieId`. It runs inside a single `withTransaction`: the employees' rows are locked with
`SELECT id FROM users WHERE "companyId" = $1 AND role = 'EMPLOYEE' AND "expiredAt" IS NULL FOR UPDATE`,
their balances are incremented in one batched `UPDATE`, and a `TOPUP` transaction
(`status: VALIDER`, `companyId` = the employer) is recorded per employee. An employer with no
active employee is a `404` and nothing is written.

**Account activation.** A salarié is created `PENDING` with the password their employer chose and
communicated to them out of band. Valid credentials therefore exist from the start, so `POST
/api/v1/login` answers `403` while `accountStatus` is not `ACCEPTED` — the verification, not the
password, is what opens the account.

Verification is a `PATCH` moving `accountStatus` from `PENDING` to `ACCEPTED` — and only that
transition; re-accepting an already-accepted account does nothing. It mails the salarié a notice
that the administration validated the account, with a link to `${APP_BASE_URL}/login`
(`APP_BASE_URL` defaults to `http://localhost:3000`). The password itself never travels by email.

**The mail goes out before anything is written.** If the provider fails, the `502` propagates and
the salarié stays `PENDING`, so the verification can simply be retried — rather than leaving an
accepted account whose owner was never told.

**Two ban stores, on purpose.** `POST /admin/ban` writes both:

- the `BannedUser` table — permanent, and the source of truth for reads such as the `isBanned`
  flag on `GET /salaries`
- a Redis key with `BAN_TTL_SECONDS` — what `authorize()` checks on every request, so the banned
  user's existing JWT stops working immediately rather than at expiry

Re-banning someone already in the table is a `409`.

**Ownership.** `authorize()` only checks the role. The finer `(own)` / `(self)` rules go through
`lib/services/ownership_service.ts`, which resolves the caller's `Users` row and compares
`companyId`. ADMIN bypasses every ownership check. Non-admin callers on list endpoints are pinned
to their own company, so passing someone else's `?employeurId=` silently yields their own scope
rather than leaking data.

## Schema changes

Three additions to `CartePro/prisma/contract.prisma` were required:

| Change | Why |
|---|---|
| `Users.companyId String?` + relation to `Company` | there was no link between a user and its company, so `employeur (own)` / `partenaire (own)` was unimplementable. Set for EMPLOYEE (their employer), COMPANY and PARTNER (the company they administer); null for ADMIN. |
| `Company.active Boolean @default(true)` | soft-delete flag; no such column existed |
| `BannedUser.reason String` + `createdAt` | `POST /admin/ban` takes a reason, and the table had nowhere to put it |

`Company.employees` and the matching indexes were added alongside.

The contract is regenerated (`prisma/contract.json`, `contract.d.ts`) and the migration is
planned, applied and verified: `migrations/app/20260905T1514_add_user_company_link_soft_delete_and_ban_reason`.
`db:verify` reports *"Database marker and schema match contract"*.

Because `BannedUser.reason` is `NOT NULL` with no default, the planner left a data-transform
placeholder; it is filled with a `rawSql` backfill setting `reason = ''` on any row that predates
the column (bans created before this migration have no recorded motive), followed by the
`SET NOT NULL`. That makes the migration replayable against an environment that already has
banned users.

To bring another environment up:

```sh
cp .env.example .env.development   # if you don't have it yet
docker compose --env-file .env.development up -d db
cd "CartePro" && npm run db:migrate && npm run db:verify
```

The `db` service is pinned to `platform: linux/amd64` in `docker-compose.yml`, since
`postgis/postgis:18-3.6` publishes no arm64 image and the container otherwise refuses to start on
Apple Silicon.

## Errors

Every handler funnels through `AppError` + `commonErrorHandler`
(`lib/services/error_service.ts`) and returns the same shape:

```json
{ "error": "message" }
```

| Code | When |
|---|---|
| `400` | zod validation failure, malformed JSON, bad pagination, non-uuid path param, empty PATCH body, an unknown field in a strict body, a salarié patching a field they may not touch, an invalid/expired/spent activation token |
| `401` | missing/invalid bearer token |
| `403` | role not allowed for the route, or allowed but acting on another company/user |
| `404` | resource absent, soft-deleted, or of the wrong kind (employer id used on a partner route); unknown category on `?categorie=`; no active employee to abond |
| `409` | duplicate `email` / `siret` / `kbisId`, user already banned, partner already a favorite |
| `502` | the activation email could not be sent; nothing was written |
| `503` | Redis ban-check unavailable (from `authorize()`) |
| `500` | anything unhandled |

## Tests

`CartePro/tests/api/` — one file per route file, plus a file per service that carries logic of
its own (`email_service`). 175 tests passing across 17 suites, run with
`JWT_SECRET=… npm run test`.

Two tests in `email_brevo_provider` fail, and predate this work: `brevo_provider.ts` hardcodes
`sender: { email: "futoltheo@gmail.com", name: "Theo" }` instead of splitting the `from` the email
service passes it, which is exactly what those two assert. No database, Redis or Docker needed: `mock-db.ts` (a small query
engine over arrays), `mock-redis.ts` and `mock-postgres.ts` are swapped in via
`jest.config.ts`'s `moduleNameMapper`. See `tests/README.md` for what the mocks support and which
fixture constants to use.

## Coverage

Every route handler under `app/api/v1/` now carries an `@openapi` block and a test file, as
`CLAUDE.md` requires. The three that previously lacked one or both —
`employees/{id}/balance`, `admin/transactions.csv` and `salaries/{salarieId}/transactions` — were
also the three that never called `authorize()`; they are now guarded, so the tests assert 401/403
rather than freezing the open behaviour in place.

That closed the first four known gaps: the unauthenticated admin routes, the `transaction.csv` key
typo in `lib/roles-config.ts` (the roles map now keys on the real path), and the transactions
route's missing docs and auth. `GET /employees/{id}/balance` was widened from ADMIN-only to
`['ADMIN', 'COMPANY', 'EMPLOYEE']` to match `API.md`, with `assertCanAccessSalarie` enforcing the
`(own)` / `(self)` half.

## Known gaps

Still open, outside the scope of the work so far:

1. `lib/swagger.ts` defines no `components.securitySchemes.bearerAuth`, so every
   `security: - bearerAuth: []` block points at an undefined scheme in Swagger UI.
2. `POST /api/v1/salaries/{salarieId}/transactions` now implements the QR code half — the body is
   `{ amount, type, content, companyId }`, where `content` is the SHA-256 hash of the scanned code —
   but refunds referencing `originalTransactionId` are still unimplemented. `GET` on the same path
   is paginated but still ignores the `from` / `to` / `type` filters.
3. **No document-upload endpoint exists.** `Users.documentId` has been dropped from the schema, so
   creating a salarié no longer needs one, but `Company.kbisId` is still non-null and unique —
   creating a company still requires a `Document` row to already exist.
   `lib/services/s3_client.ts` is present but unused — someone needs to own this.
4. Seed data does not set `Users.companyId`. Until `dev/generate-seed.ts` is updated, a freshly
   seeded database has every user unattached, so the ownership checks and
   `GET /salaries?employeurId=` return nothing for non-admin callers.
