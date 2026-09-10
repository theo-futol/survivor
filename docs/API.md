This document describes the API as implemented in `CartePro/app/api/v1/`. Each handler also
carries an `@openapi` JSDoc block, rendered as Swagger UI on the `/docs` page.

## Authentication

- Endpoint: `POST /api/v1/login`
- Body: `{ "email": "user@example.com", "password": "secret" }`
- Password rules (enforced on login *and* on every password write): 8 to 32 characters, with at
  least one uppercase, one lowercase, one digit and one special character.
- Success response (200):

```json
{ "token": "eyJhbGci...", "expiresIn": 1800, "user": { "id": "...", "role": "EMPLOYEE" } }
```

- `expiresIn` comes from `JWT_TTL_SECONDS` and defaults to **1800 seconds (30 minutes)**.
- The same JWT is also written to the **HttpOnly cookie `ticket_tout_token`** (`SameSite=Lax`,
  `Secure` over HTTPS or in production), so the web app is authenticated without touching the
  token in JavaScript.
- Errors: `400` (bad body), `401` (invalid credentials, or a deactivated account), `403`
  (`accountStatus` is not `ACCEPTED` — "Compte non validé"), `500`.

- Endpoint: `DELETE /api/v1/login` — logout. Clears the session cookie, returns `200 { "ok": true }`.

Authenticated requests are accepted with **either** `Authorization: Bearer <token>` **or** the
session cookie; `getRequestToken()` prefers the header and falls back to the cookie.

### What `authorize()` checks, in order

1. A token is present and its signature verifies — otherwise `401 Missing or invalid token`.
2. The user still exists (`401`) and is not deactivated, i.e. `expiredAt` is null — otherwise
   `403 Account inactive`.
3. The user is not banned — otherwise `403 Account revoked`. The check hits Redis first and falls
   back to the `bannedUser` table if Redis is unreachable.
4. The caller's role is allowed for this route, per `lib/roles-config.ts` — otherwise `403 Forbidden`.

If PostgreSQL (or both Redis and PostgreSQL) is unreachable during those checks, the answer is
`503 Auth service temporarily unavailable` rather than a 500.

## General principles

- Roles are `ADMIN`, `COMPANY`, `PARTNER`, `EMPLOYEE` — spelled exactly like that in the JWT and in
  `lib/roles-config.ts`, which is the single source of truth for endpoint permissions. Extend that
  map whenever a protected handler is added.
- Success codes: `200` (OK), `201` (Created), `204` (No Content)
- Errors: `400` (validation), `401` (unauthenticated), `403` (forbidden), `404` (not found),
  `409` (conflict), `502` (upstream provider failed), `503` (dependency unavailable), `500` (server)
- Errors are returned as `{ "error": "message" }`.
- **Two pagination shapes exist** — see "Pagination" below; they are not interchangeable.
- Amounts are **integers, in cents**.
- Text fields reject `< > ' " &` so nothing can be echoed back into HTML.
- Deletions are **logical**: a company gets `active = false`, a salarié gets `expiredAt` dated. The
  rows stay because immutable transactions reference them. They then disappear from every read.
- Password storage: **SHA-256** (`crypto.createHash('sha256')`), compared in constant time. Plaintext
  is never stored and never returned.
- See `administratif/fiche-registre.md` for the full data model, relationships and data protection measures.

### Pagination

| Shape | Used by | `meta` |
| --- | --- | --- |
| A | `GET /employeurs`, `GET /partenaires`, `GET /salaries` | `{ page, limit, total }`, alongside a `data` array |
| B | `GET /salaries/{id}/transactions`, `GET /partenaires/{id}/transactions` | `{ page, limit, totalCount, totalPages, hasNextPage, hasPrevPage }`, alongside a `transactions` array |

Both accept `?page=` and `?limit=` (defaults `page=1`, `limit=20`, `limit` capped at 100). Shape A
rejects invalid values with `400 Invalid pagination parameters`; shape B with `400 Invalid query
parameters`.

**Not implemented**: generic sorting (`?sort=`), date filters (`?from=`, `?to=`), `?type=` on
transaction lists, and `?featured=` on partners. The filters that do exist are listed per endpoint.

---

## Signup (public)

- `POST /api/v1/signup`
  - Roles: public.
  - Content type: **`multipart/form-data`**.
  - Fields: `accountType` (`company` | `partner`), `organizationName`, `registrationNumber` (14
    digits), `email`, `password`, `phone`, `legalRepresentative`, `jobTitle`, `address`,
    `postalCode` (5 digits), `city`, `category`, `description` (optional), and `kbis`.
  - `kbis` must be a **PDF of at most 5 MB**. It is stored in Garage (S3), and a `document` row
    records its storage key; the company row points at it through `kbisId`.
  - Behavior: creates the company and its owner user, unverified so the account stays visible in the
    admin backlog, then opens a session (same JWT + cookie as login). An acknowledgement email is
    then sent to the company (best effort — a mail failure never rolls back the account).
  - Success: `201` with the created account, plus `expiresIn`.
  - Errors: `400` (invalid form or Kbis), `409` (email or SIRET already used), `503` (Garage
    unavailable).

- `GET /api/v1/categories`
  - Roles: public — the signup form reads it.
  - Success: `200` `{ "categories": [ { "id": 1, "category": "Restauration" } ] }`, sorted by label.

---

## Current user

- `GET /api/v1/me`
  - Roles: all authenticated.
  - Success: `200` `{ "user": { id, email, surname, name, role, balance, companyId, createdAt }, "company": { ... , "category": { id, category } } | null }`.
  - `company` is only populated when the user's company is active.
  - Errors: `401`, `403` (revoked), `404` (user not found or deactivated), `503`.
  - **Note**: `lib/roles-config.ts` also declares `PATCH /api/v1/me` and `DELETE /api/v1/me`, but
    the handler only exports `GET`; those two methods answer `405`.

---

## Employers

- `GET /api/v1/employeurs`
  - Roles: `ADMIN`, `COMPANY`
  - Query: `?page=&limit=&search=` (`search` is a case-insensitive filter on the company name)
  - Scope: a `COMPANY` only ever sees its own company, whatever it asks for; `ADMIN` sees all.
    Soft-deleted companies (`active = false`) are excluded.
  - Success: `200` `{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 123 } }`

- `POST /api/v1/employeurs`
  - Roles: `ADMIN`
  - Every non-nullable `company` column is required. `kbisId` must reference a `document` row that
    already exists — this endpoint does not upload anything; `POST /api/v1/signup` is the route that
    creates KBIS documents.
  - Body:

```json
{
  "name": "Entreprise SA",
  "email": "contact@ex.com",
  "siret": "12345678901234",
  "kbisId": "uuid-of-existing-document",
  "description": "...",
  "address": "12 rue ...",
  "postalCode": "13001",
  "agentId": "uuid-of-admin-user",
  "reasonId": 1,
  "categoryId": 1,
  "location": { "lat": 43.29, "lng": 5.37 }
}
```

  - `verified` is **not accepted here**: every company is created unverified and is validated
    afterwards through `PATCH`.

  - Success: `201` returns the created employer.
  - Errors: `400`, `409` (email, SIRET or KBIS already used).

- `PATCH /api/v1/employeurs/{employeurId}`
  - Roles: `ADMIN`, `COMPANY` (own only)
  - Body: any non-empty subset of the creation fields, plus `verified`. `isPartner` and `active` are
    server-driven and are rejected.
  - `verified`, `agentId`, `reasonId` and `kbisId` record the administrative review: only an `ADMIN`
    may send them, a `COMPANY` gets a `403` — it cannot validate itself.
  - Setting `verified` to `true` on a company that was not verified yet **emails the company** to
    tell it the account is validated and that it can now sign in. The mail is sent before the write,
    so a provider outage answers `502` and leaves the company unverified, ready to be retried.
  - Success: `200` returns the updated object.
  - Errors: `400`, `403`, `404`, `409`, `502` (validation email not sent).

- `DELETE /api/v1/employeurs/{employeurId}`
  - Roles: `ADMIN`
  - Behavior: **logical delete** — sets `active = false`. It never returns `409`; the row is kept
    precisely because transactions reference it.
  - Success: `204`.

---

## Abondements

- `POST /api/v1/employeurs/{employeurId}/abondements`
  - Roles: `ADMIN` only. Abondements are driven from the admin dashboard
    (`app/admin/page.tsx`); a company cannot fund itself, and the employer space never calls this.
  - Body:

```json
{ "montant": 5000, "date": "2026-09-01", "type": "fixe", "comment": "Abondement Q3" }
```

  - `montant` is a positive integer in cents. `type` (`fixe` | `variable`) and `comment` are
    validated but **not persisted** — no columns exist for them. `date` is accepted and ignored.
  - Behavior: credits `montant` to **every active employee of the company** — this is a bulk
    operation, not a per-employee one. It all runs in one PostgreSQL transaction: the employee rows
    are locked with `SELECT … FOR UPDATE`, balances are updated, and one immutable `TOPUP`
    transaction (status `VALIDER`) is inserted per employee. A `TOPUP` row is stored with a **null
    `companyId`**, as required by the `transaction_type_matches_company` constraint.
  - Success: `201` `{ "montant": 5000, "salariesCredites": 12, "montantTotal": 60000 }`
  - Errors: `404` (employer not found, **or no active employee to credit**).

---

## Employees (salaries)

- `GET /api/v1/salaries`
  - Roles: `ADMIN`, `COMPANY`
  - Query: `?employeurId=&includeInactive=&page=&limit=`. `includeInactive=true` also returns
    deactivated accounts; by default only `expiredAt IS NULL` rows are listed. A `COMPANY` is pinned
    to its own company whatever `employeurId` says.
  - Each row carries `active`, `isBanned`, `transactionCount` and `transactionTotal` on top of the
    profile fields.
  - Success: `200` paginated list (shape A).

- `POST /api/v1/salaries`
  - Roles: `ADMIN`, `COMPANY` (own company only)
  - Body — note the field names, which differ from the French labels used elsewhere in this doc:

```json
{ "companyId": "...", "surname": "Dupont", "name": "Jean", "email": "j.dupont@ex.com", "password": "Secret123!" }
```

  - `surname` is the family name, `name` the first name. The schema is **strict**: any extra field
    (`accountStatus`, `role`, `balance`, …) is a `400`.
  - Behavior: the employer supplies the password; the server stores only its hash and never returns
    it. The server forces `role = EMPLOYEE`, `balance = 0` and `accountStatus = PENDING`, so login is
    refused until an agent verifies the account.
  - Success: `201` returns the created employee without the password.
  - Errors: `400`, `403`, `404` (company not found), `409` (email already used).

- `GET /api/v1/salaries/{salarieId}`
  - Roles: `ADMIN`, `COMPANY` (own), `EMPLOYEE` (self)
  - Success: `200` `{ id, email, surname, name, balance, companyId, role, createdAt }`.

- `PATCH /api/v1/salaries/{salarieId}`
  - Roles: `ADMIN`, `COMPANY` (own), `EMPLOYEE` (self, limited)
  - `ADMIN` / `COMPANY` may set `email`, `surname`, `name`, `password`, `active`, `accountStatus`.
  - An `EMPLOYEE` editing itself is limited to `surname`, `name`, `password`, under a **strict**
    schema — sending `accountStatus` alongside a legal field is an explicit `400`, not a silent drop.
  - `active=false` dates `expiredAt`; `active=true` clears it.
  - **Account verification**: moving `accountStatus` from `PENDING` to `ACCEPTED` sends the employee
    an email saying the account is validated, with a link to the app; they log in with the password
    their employer gave them at creation. The password is never emailed. The mail is sent **before**
    any write, so a provider failure returns `502` and leaves the account `PENDING`, ready to retry.
    Other status transitions are plain updates.
  - Success: `200` returns the updated employee (password stripped, `active` added).
  - Errors: `400`, `403`, `404`, `409` (email taken), `502` (email provider).

- `DELETE /api/v1/salaries/{salarieId}`
  - Roles: `ADMIN`, `COMPANY` (own)
  - Behavior: **logical delete** — dates `expiredAt`. It never returns `409`.
  - Success: `204`.

---

## Transactions

- `GET /api/v1/salaries/{salarieId}/transactions`
  - Roles: `ADMIN`, `COMPANY` (own), `EMPLOYEE` (self)
  - Query: `?page=&limit=` only.
  - Success: `200` `{ "transactions": [ ... ], "meta": { ... } }` (shape B), newest first.
  - Errors: `400`, `403`, `404` (salarié not found).

- `POST /api/v1/salaries/{salarieId}/transactions`
  - Roles: `ADMIN`, `COMPANY`, `PARTNER` (own shop only — a `PARTNER` must pass its own `companyId`)
  - Behavior: cashes in a QR code the employee is showing. `content` is the **SHA-256 hash** of the
    scanned code, not the code itself — the database only ever stores the hash. The QR code must
    belong to `salarieId`, have been issued for `companyId`, and not be expired. A `PAYMENT` debits
    the balance; `REFUND` and `TOPUP` credit it. `amount` is in **cents** and must be a positive
    integer.
  - `SELECT … FOR UPDATE` locks the employee's balance row during the transaction to prevent race
    conditions. The lock, the ledger insert and the QR code consumption all run in the same
    PostgreSQL transaction.
  - A validated payment **consumes** the QR code (the row is deleted), so the same scan cannot be
    replayed during the five minutes the code would otherwise stay valid. A `REFUSER` leaves it
    spendable.
  - The `transaction_type_matches_company` constraint means a `TOPUP` row is stored with a null
    `companyId`; every other type keeps the partner company. The response echoes that null.
  - Body:

```json
{ "amount": 1500, "type": "PAYMENT", "content": "<sha256 du code scanné>", "companyId": "..." }
```

  - Rules: the server recomputes the balance and keeps an immutable history. The `status` is the
    server's call — a final balance below zero is recorded as `REFUSER` with the balance untouched,
    it is **not** an error, and the response is still `201`.
  - Success: `201` `{ "message": "Transaction created successfully", "newBalance": 1234, "status": "VALIDER", "companyId": "..." }`.
  - Errors: `400` (bad body, or expired QR), `403` (QR belongs to another salarié or company),
    `404` (salarié or QR not found).
  - Not implemented: refunds referencing `originalTransactionId` (the column exists, the endpoint
    does not set it).

- PATCH / DELETE: not exposed; to cancel, create a `REFUND` transaction.

- `GET /api/v1/partenaires/{partenaireId}/transactions`
  - Roles: `ADMIN`, `PARTNER` (own)
  - Query: `?page=&limit=` (`from` / `to` / `type` are not implemented)
  - List of transactions billed to the partner, newest first, each including the salarié who paid
    (`user: { id, name, surname }`). This is what the partner dashboard's history tab reads.
  - A partner with no sales yet gets `200` with an empty list — not a `404`.

---

## Partners

- `GET /api/v1/partenaires`
  - Roles: `ADMIN`, `PARTNER`, `COMPANY`, `EMPLOYEE`
  - Query: `?page=&limit=&categorie=` (`categorie` is the category **name**, not its id; an unknown
    one is a `404`).
  - Scope: an `EMPLOYEE` only sees **verified** partners; a `PARTNER` only sees its own record;
    `ADMIN` and `COMPANY` see the whole active network.
  - Output: full profile including the company category.
  - Success: `200` paginated list (shape A).

- `POST /api/v1/partenaires`
  - Roles: `ADMIN`
  - Same body and constraints as `POST /api/v1/employeurs`, with `isPartner = true`. `verified` is
    likewise not accepted.

- `PATCH /api/v1/partenaires/{partenaireId}`
  - Roles: `ADMIN`, `PARTNER` (own)
  - Same rules as `PATCH /api/v1/employeurs/{employeurId}`: `verified`, `agentId`, `reasonId` and
    `kbisId` are admin-only, and flipping `verified` to `true` emails the partner.

- `DELETE /api/v1/partenaires/{partenaireId}`
  - Roles: `ADMIN`
  - Behavior: **logical delete** — sets `active = false`.
  - Success: `204`.

---

## SIRH service

- `GET /api/v1/employees/{id}/balance`
  - Roles: `ADMIN`, `COMPANY` (own), `EMPLOYEE` (self)
  - Success: `200` `{ "balance": 12345 }` — the payload carries the balance only, no `employeeId`.
  - Errors: `400` (id is not a UUID), `403`, `404` if the employee does not exist.

---

## QRCODE

- `POST /api/v1/qrcode`
  - Roles: `EMPLOYEE`
  - Behavior: generates a payment QR code for the authenticated employee, valid **5 minutes**. The
    code is generated with `crypto`; only its **SHA-256 hash** is stored, in `qrCode.content`, and
    the row carries `expiredAt`. Only one valid QR code per employee **per partner company** at a
    time — a second request while one is live is a `409`.
  - `userId` must match the token's subject; anything else is a `403`.
  - Body:

```json
{ "companyId": "...", "userId": "..." }
```

  - Success: `201` `{ "qrcode": "xkekE24...", "expiresAt": "2026-09-02T12:34:56Z" }` — `qrcode` is
    the plaintext code, returned once, for the frontend to render.
  - Errors: `400`, `403`, `404` (partner company not found), `409` (a valid code already exists).

- `POST /api/v1/qrcode/resolve`
  - Roles: `ADMIN`, `PARTNER`
  - Behavior: the scanned QR code carries the plaintext code only, which says nothing about whose
    card it is. This turns its SHA-256 hash into the salarié to bill, so the partner can then call
    `POST /api/v1/salaries/{salarieId}/transactions`. The hash travels in the body rather than the
    URL because it is what authorises the charge — it has no business in access logs. A partner may
    only resolve codes issued for its own company. Resolving does **not** consume the code.
  - Body:

```json
{ "content": "<sha256 du code scanné>" }
```

  - Success: `200` `{ "salarieId": "...", "name": "...", "surname": "...", "companyId": "...", "expiresAt": "..." }`
  - Errors: `400` malformed or expired, `403` issued for another company, `404` unknown code or
    salarié no longer active.

---

## ADMIN

- `POST /api/v1/admin/ban`
  - Roles: `ADMIN`
  - Behavior: bans a user by `userId` for a `reason`. The ban is written in two places: the
    `bannedUser` table, which is the durable source of truth for reads (the `isBanned` field of
    `GET /api/v1/salaries`), and a Redis key that `authorize()` consults on every request, which
    invalidates the user's token immediately.
  - Body:

```json
{ "userId": "...", "reason": "Violation of terms" }
```

  - Success: `200` `{ "status": "banned", "userId": "...", "reason": "Violation of terms" }`
  - Errors: `400`, `404` (unknown user), `409` (already banned).
  - Not implemented: un-banning.

- `GET /api/v1/admin/transactions.csv`
  - Roles: `ADMIN`
  - Returns **every** transaction as a CSV attachment (`transactions.csv`), no pagination and no
    filters. Semicolon-separated, header
    `id;date_iso8601;employee_id;partner_id;amount_cents;status`.
  - Success: `200`, `Content-Type: text/csv`.

- `GET /api/v1/admin/employeurs/{id}/kbis`
  - Roles: `ADMIN`
  - Reads the employer's KBIS document reference in PostgreSQL, then streams the file back from
    Garage as a PDF attachment (`kbis-<siret>.pdf`), with `Cache-Control: private, no-store`.
  - Errors: `400` (bad id), `404` (employer, document reference or stored object missing),
    `503` (Garage unavailable).

## Roles and permissions (summary)

`lib/roles-config.ts` is authoritative; this table is a summary.

| Role | Permissions |
|---|---|
| `ADMIN` | Full access to all resources and operations, plus the admin-only exports (ban, CSV, KBIS). |
| `COMPANY` | Manages its own company record, its employees and their transactions. Reads the partner network. Cannot abonder — that is an admin operation. |
| `PARTNER` | Reads and edits its own partner record, reads its own transactions, resolves QR codes issued for it and cashes them in. |
| `EMPLOYEE` | Reads its own profile, balance and transactions, edits its own name and password, browses verified partners, generates its own payment QR codes. |

---

## Error examples

- `400 Bad Request` — validation failed, or an expired QR code.
- `401 Unauthorized` — missing or invalid token.
- `403 Forbidden` — insufficient role, deactivated account (`Account inactive`), banned account
  (`Account revoked`), or an attempt to act on another company's or employee's data.
- `404 Not Found` — resource not found.
- `409 Conflict` — duplicate email / SIRET / KBIS, a live QR code, or an already-banned user.
- `502 Bad Gateway` — the email provider refused the validation email; nothing was written.
- `503 Service Unavailable` — PostgreSQL, Redis or Garage unreachable.
