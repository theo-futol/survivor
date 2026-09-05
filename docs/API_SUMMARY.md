# API_SUMMARY

What was actually built on the backend, as opposed to `API.md`, which describes the intent.
Where the two disagree, **this document describes the shipped behaviour** and says why.

## Scope

Implemented here: Employers, Abondements, Employees (salariés), Partners, Admin ban,
MinisterFavorite.

Explicitly **not** in this scope, owned by others:

- everything under `## Transactions` in `API.md` (`GET`/`POST /salaries/{salarieId}/transactions`,
  `GET /partenaires/{partenaireId}/transactions`)
- the SIRH endpoint `GET /employees/{id}/balance`
- document upload — there is no endpoint anywhere in the repo, yet `Users.documentId` and
  `Company.kbisId` are non-null (see *Known gaps*)

## Endpoints

All routes require `Authorization: Bearer <token>`. The role column is the coarse gate from
`Ticket Tout/lib/roles-config.ts`; the *Extra rule* column is enforced inside the handler.

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
| `GET /api/v1/ministerfavorite` | ADMIN | — | 200 | `app/api/v1/ministerfavorite/route.ts` |
| `POST /api/v1/ministerfavorite` | ADMIN | — | 200 | `app/api/v1/ministerfavorite/route.ts` |
| `PATCH /api/v1/ministerfavorite/{partnerId}` | ADMIN | — | 200 | `app/api/v1/ministerfavorite/[partnerId]/route.ts` |
| `DELETE /api/v1/ministerfavorite/{partnerId}` | ADMIN | — | 200 | `app/api/v1/ministerfavorite/[partnerId]/route.ts` |

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
| `POST /salaries` has no password | `password` required, bcrypt-style hashed via `hashPassword` | `Users.password` is non-null |
| `POST /salaries` has no document | `documentId` required (uuid) | `Users.documentId` is non-null and unique |
| Abondement body `{montant, date, type, comment}` | all validated; only `montant` is persisted | no columns exist for `type` / `comment` |
| `DELETE` employer "may return 409 if referenced" | always soft-deletes, never 409 | transactions are immutable, so the row must survive |
| `PATCH` and `DELETE /ministerfavorite/{partnerId}` | both remove, identical response | `API.md` documents both with the same behaviour |

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
  "password": "Secret123!",
  "documentId": "uuid-of-an-existing-Document",
  "companyId": "uuid-of-the-employer"
}
```

`role` is forced to `EMPLOYEE` and `balance` to `0`. The hashed password is never returned.
`PATCH` accepts `email`, `surname`, `name`, `documentId`, `password` — but a salarié editing
themselves is restricted to `surname`, `name`, `password`, and anything else is a `400`.

**`POST .../abondements`** — `{ "montant": 5000, "date": "2026-09-01", "type": "fixe", "comment": "…" }`
(`montant` a positive integer, `type` one of `fixe` | `variable`).

**`POST /api/v1/admin/ban`** — `{ "userId": "<uuid>", "reason": "Violation of terms" }`.

**`POST /api/v1/ministerfavorite`** — `{ "partnerId": "<uuid>" }`.

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

`GET /api/v1/ministerfavorite` returns `{ "favorites": [ { "partnerId", "name", "likeAmount" } ] }`.

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

Three additions to `Ticket Tout/prisma/contract.prisma` were required:

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
cd "Ticket Tout" && npm run db:migrate && npm run db:verify
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
| `400` | zod validation failure, malformed JSON, bad pagination, non-uuid path param, empty PATCH body, a salarié patching a field they may not touch |
| `401` | missing/invalid bearer token |
| `403` | role not allowed for the route, or allowed but acting on another company/user |
| `404` | resource absent, soft-deleted, or of the wrong kind (employer id used on a partner route); unknown category on `?categorie=`; no active employee to abond |
| `409` | duplicate `email` / `siret` / `kbisId` / `documentId`, user already banned, partner already a favorite |
| `503` | Redis ban-check unavailable (from `authorize()`) |
| `500` | anything unhandled |

## Tests

`Ticket Tout/tests/api/` — one file per route file, 105 tests total, run with
`JWT_SECRET=… npm run test`. No database, Redis or Docker needed: `mock-db.ts` (a small query
engine over arrays), `mock-redis.ts` and `mock-postgres.ts` are swapped in via
`jest.config.ts`'s `moduleNameMapper`. See `tests/README.md` for what the mocks support and which
fixture constants to use.

## Known gaps

Found while building this, deliberately **not** fixed because they sit outside this scope:

1. `GET /api/v1/employees/{id}/balance` and `GET /api/v1/admin/transactions.csv` never call
   `authorize()` — both are documented as ADMIN-only but are effectively public.
2. `lib/roles-config.ts` has `'GET /api/v1/admin/transaction.csv'`, missing the `s`, so it can
   never match the real route path.
3. `lib/swagger.ts` defines no `components.securitySchemes.bearerAuth`, so every
   `security: - bearerAuth: []` block — the pre-existing qrcode one and all the new ones — points
   at an undefined scheme in Swagger UI.
4. `app/api/v1/salaries/[salarieId]/transactions/route.ts` has neither an `authorize()` call nor
   an `@openapi` block.
5. **No document-upload endpoint exists**, yet `Users.documentId` and `Company.kbisId` are both
   non-null and unique. Creating a salarié or a company therefore requires a `Document` row to
   already exist. `lib/services/s3_client.ts` is present but unused — someone needs to own this.
6. Seed data does not set `Users.companyId`. Until `dev/generate-seed.ts` is updated, a freshly
   seeded database has every user unattached, so the ownership checks and
   `GET /salaries?employeurId=` return nothing for non-admin callers.
