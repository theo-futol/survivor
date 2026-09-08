## Authentication

- Endpoint: `POST /api/v1/login`
- Body: `{ "email": "user@example.com", "password": "secret" }`
- The JWT token must contain the user's role and expire in 1 hour. The token is used for all subsequent authenticated requests.
- Success response (200):

```json
{ "token": "eyJhbGci...", "expiresIn": 3600, "user": { "id": "...", "role": "employeur" } }
```

- Common errors: `400` (bad request), `401` (invalid credentials), `500` (server error).
- All authenticated requests must include the header: `Authorization: Bearer <token>`.

## General principles

- Success codes: `200` (OK), `201` (Created), `204` (No Content)
- Errors: `400` (validation), `401` (unauthenticated), `403` (forbidden), `404` (not found), `409` (conflict), `500` (server)
- Pagination: list endpoints support `?page=` and `?limit=` (defaults: `page=1, limit=20`).
- Filtering & sorting: use query params (`?employeurId=`, `?categorie=`, `?sort=-createdAt`).
- Password storage: hashed with bcrypt (SHA-256); never store plaintext passwords.
- See @fiche-registre.md for the full data model, relationships and data protection measures (encryption, hashing).
- Use a file configuration for determining access based on roles for each endpoint.

---

## Employers

- `GET /api/v1/employeurs`
  - Roles: `admin`, `employeur`
  - Query: `?page=&limit=&search=`
  - Success: `200` `{ "data": [ ... ], "meta": { "page":1, "limit":20, "total": 123 } }`

- `POST /api/v1/employeurs`
  - Roles: `admin`
  - Body example:

```json
{ "name": "Entreprise SA", "email": "contact@ex.com", "siret": "12345678901234", "address": "..." }
```

  - Success: `201` returns the created employer.

- `PATCH /api/v1/employeurs/{employeurId}`
  - Roles: `admin`, `employeur` (own)
  - Success: `200` returns the updated object.

- `DELETE /api/v1/employeurs/{employeurId}`
  - Roles: `admin`
  - Behavior: checks for active employees or requires controlled cascade delete; may return `409` if referenced.
  - Success: `204`.

---

## Abondements

- `POST /api/v1/employeurs/{employeurId}/abondements`
  - Roles: `admin`, `employeur` (own)
  - Body example:
  - Behavior: server updates the salaries' balances and creates an immutable transaction history for the abondement.

```json
{ "montant": 5000, "date": "2026-09-01", "type": "fixe", "comment": "Abondement Q3" }
```

  - Success: `201` returns the created abondement and updates related balances.

---

## Employees (salaries)

- `GET /api/v1/salaries`
  - Roles: `admin`, `employeur`
  - Supports: `?employeurId=`, `?page=`, `?limit=`
  - Success: `200` paginated list.
  - Also includes if the user is banned or not, the total amount of transactions and the count of transctions associated with the employee.

- `POST /api/v1/salaries`
  - Roles: `admin`, `employeur`
  - Body example:
  - Behavior: the employer supplies the employee's password in the body; the server hashes it and never returns it. The account is created `PENDING`, so login is refused until an agent verifies it.

```json
{ "employeurId": "...", "nom": "Dupont", "prenom": "Jean", "email": "j.dupont@ex.com", "password": "Secret123!" }
```

  - Success: `201` creates the employee.

- `PATCH /api/v1/salaries/{salarieId}`
  - Roles: `admin`, `employeur` (own), `salarie` (self, limited)
  - Success: `200` updated.
  - Behavior: function check if the modification is the verification of the account (changed the field `accountStatus` to `ACCEPTED`, to be the verification the `accountStatus` field is initially `PENDING`), in case of the account is verified, send an email using the brevo service to notify the employee that his account is verified, with a link to the app; he logs in with the password his company gave him at creation. The password is never sent by email.

- `DELETE /api/v1/salaries/{salarieId}`
  - Roles: `admin`, `employeur` (own)
  - Success: `204` or `409` if referenced by immutable transactions.

---

## Transactions

- `GET /api/v1/salaries/{salarieId}/transactions`
  - Roles: `admin`, `employeur` (own), `salarie` (self)
  - Supports: `?page=&limit=&from=&to=&type=`
  - Success: `200` paginated list.

- `POST /api/v1/salaries/{salarieId}/transactions`
  - Roles: `admin`, `employeur` (own), `partenaire` (own shop only)
  - Behavior: cashes in a QR code the employee is showing. `content` is the **SHA-256 hash** of the
    scanned code, not the code itself — the database only ever stores the hash. The QR code must
    belong to `salarieId`, have been issued for `companyId`, and not be expired. A `PAYMENT` debits
    the balance; `REFUND` and `TOPUP` credit it. `amount` is in **cents** and must be a positive
    integer.
  - SELECT_FOR_UPDATE is used to lock the employee's balance row during the transaction to prevent
    race conditions. The lock, the ledger insert and the QR code consumption all run in the same
    PostgreSQL transaction.
  - A validated payment **consumes** the QR code, so the same scan cannot be replayed during the
    five minutes the code would otherwise stay valid. A `REFUSER` leaves it spendable.
  - The `transaction_type_matches_company` constraint means a `TOPUP` row is stored with a null
    `companyId`; every other type keeps the partner company.
  - Body example:

```json
{ "amount": 1500, "type": "PAYMENT", "content": "<sha256 du code scanné>", "companyId": "..." }
```

  - Rules: server recomputes the employee's `soldeActuel` and keeps an immutable transaction history.
    The `status` is the server's call — a final balance below zero is recorded as `REFUSER` with the
    balance untouched, it is not an error.
  - Success: `201` returns `{ "message": "...", "newBalance": 1234, "status": "VALIDER", "companyId": "..." }`.
  - Not implemented: refunds referencing `originalTransactionId`.

- PATCH / DELETE: not exposed; to cancel, create a `REFUND` transaction referencing `originalTransactionId`.

- `GET /api/v1/partenaires/{partenaireId}/transactions`
  - Roles: `admin`, `partenaire` (own)
  - Supports: `?page=&limit=` (`from` / `to` / `type` are not implemented)
  - List of transactions billed to the partner, newest first, each including the salarié who paid
    (`user: { id, name, surname }`). This is what the partner dashboard's history tab reads.
  - A partner with no sales yet gets `200` with an empty list — not a `404`.

---

## Partners

- `GET /api/v1/partenaires`
  - Roles: `admin`, `partenaire`
  - Supports: `?categorie=`, `?featured=`
  - Output: list of partners with the full profile also include the company category.

- `POST /api/v1/partenaires`
  - Roles: `admin`

- `PATCH /api/v1/partenaires/{partenaireId}`
  - Roles: `admin`, `partenaire` (own)

- `DELETE /api/v1/partenaires/{partenaireId}`
  - Roles: `admin`
  - Soft-delete recommended if referenced by transactions.

---

## SIRH service

- `GET /api/v1/employees/{id}/balance`
  - Roles: `admin`, `employeur` (own), `salarie` (self)
  - Success: `200` `{ "employeeId": "...", "balance": 12345 }`
  - Error: `404` if the employee does not exist.

---

## QRCODE

- `POST /api/v1/qrcode`
  - Roles: `salarie`
  - Behavior: generates a QR code for the employee to use in a payment transaction. The QR code is valid for 5 minutes and is stored in the database with an expiration timestamp at `expiresAt`. Only one valid QR code per employee for each company at a time so you must check if a QR code already exists before generating a new one.
  - Body example:

```json
{ "companyId": "...", "userId": "..." }
```

  - Success: `201` returns `{ "qrcode": "xkekE24,...", "expiresAt": "2026-09-02T12:34:56Z" }`
  - Generate a random id using crypto which be used by the frontend to generate the QR code.

- `POST /api/v1/qrcode/resolve`
  - Roles: `admin`, `partenaire`
  - Behavior: the scanned QR code carries the plaintext code only, which says nothing about whose
    card it is. This turns its SHA-256 hash into the salarié to bill, so the partner can then call
    `POST /api/v1/salaries/{salarieId}/transactions`. The hash travels in the body rather than the
    URL because it is what authorises the charge — it has no business in access logs. A partner may
    only resolve codes issued for its own company. Resolving does not consume the code.
  - Body example:

```json
{ "content": "<sha256 du code scanné>" }
```

  - Success: `200` returns `{ "salarieId": "...", "name": "...", "surname": "...", "companyId": "...", "expiresAt": "..." }`
  - Errors: `400` malformed or expired, `403` issued for another company, `404` unknown code.

---

## ADMIN

- `POST /api/v1/admin/ban`
  - Roles: `admin`
  - Behavior: bans a user by their `userId` for a given `reason`. 
  - Body example:

```json
{ "userId": "...", "reason": "Violation of terms" }
```

  - Success: `200` returns `{ "status": "banned", "userId": "...", "reason": "Violation of terms" }`

## Roles and permissions (summary)

| Role | Permissions |
|---|---|
| `admin` | Full access to all resources and operations (global CRUD). |
| `employeur` | Manages their company account, employees, transactions and abondements. Can view reports and balances. |
| `partenaire` | Read access to their profile and transactions; may initiate certain transactions by contract (e.g., payments). |
| `salarie` | View own profile and transactions, view balance; limited actions (e.g., refund request). |

---

## Error examples

- `401 Unauthorized` — missing or invalid token.
- `403 Forbidden` — insufficient role for the operation.
- `404 Not Found` — resource not found.
- `409 Conflict` — attempt to delete or create conflicting resource (duplicate, FK referenced).