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

- `GET /api/v1/employeurs/{employeurId}`
  - Roles: `admin`, `employeur`
  - Success: `200` `{ "id":"...","name":"...","email":"...","siret":"..." }`

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

- `GET /api/v1/salaries/{salarieId}`
  - Roles: `admin`, `employeur` (own), `salarie` (self)
  - Success: `200` employee object + associated valid qr-codes.

- `POST /api/v1/salaries`
  - Roles: `admin`, `employeur`
  - Body example:

```json
{ "employeurId": "...", "nom": "Dupont", "prenom": "Jean", "email": "j.dupont@ex.com", "numeroSalarie": "S123" }
```

  - Success: `201` creates the employee.

- `PATCH /api/v1/salaries/{salarieId}`
  - Roles: `admin`, `employeur` (own), `salarie` (self, limited)
  - Success: `200` updated.

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
  - Roles: `admin`, `employeur` (own), `partenaire` (when applicable)
  - Behavior: In case of the amount > 0, it's a payment : the body must contain a qr-code (string), check in the database if the qr-code is valid and not expired. If the amount < 0, it's a refund : the body must contain the originalTransactionId to reference the transaction to refund.
  - SELECT_FOR_UPDATE is used to lock the employee's balance row during the transaction to prevent race conditions.
  - Body example:

```json
{ "amount": 1500, "type": "PAYMENT", "qrcode": "T20260902-01" }
```

  - Rules: server recomputes the employee's `soldeActuel` and keeps an immutable transaction history.
  - Success: `201` returns the created transaction and the new balance.

- PATCH / DELETE: not exposed; to cancel, create a `REFUND` transaction referencing `originalTransactionId`.

---

## Partners

- `GET /api/v1/partenaires`
  - Roles: `admin`, `partenaire`
  - Supports: `?categorie=`, `?featured=`

- `GET /api/v1/partenaires/{partenaireId}`
  - Roles: `admin`, `partenaire`

- `POST /api/v1/partenaires`
  - Roles: `admin`

- `PATCH /api/v1/partenaires/{partenaireId}`
  - Roles: `admin`, `partenaire` (own)

- `DELETE /api/v1/partenaires/{partenaireId}`
  - Roles: `admin`
  - Soft-delete recommended if referenced by transactions.

- `GET /api/v1/partenaires/{partenaireId}/transactions`
  - Roles: `admin`
  - Supports: `?page=&limit=&from=&to=&type=`
  - Success: `200` paginated list.

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

---

## Roles and permissions (summary)

| Role | Permissions |
|---|---|
| `admin` | Full access to all resources and operations (global CRUD). |
| `employeur` | Manages their company account, employees, transactions and abondements. Can view reports and balances. |
| `partenaire` | Read access to their profile and transactions; may initiate certain transactions by contract (e.g., payments). |
| `salarie` | View own profile and transactions, view balance; limited actions (e.g., refund request). |
| `sirh` | (optional) Internal HR service: limited read/write within scope, access to balances for SIRH integration. |

---

## Error examples

- `401 Unauthorized` — missing or invalid token.
- `403 Forbidden` — insufficient role for the operation.
- `404 Not Found` — resource not found.
- `409 Conflict` — attempt to delete or create conflicting resource (duplicate, FK referenced).