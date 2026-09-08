// Maps each protected endpoint (method + path, as documented in docs/API.md)
// to the roles allowed to call it. Extend this map whenever a new protected
// route handler is added; POST /api/v1/login is intentionally absent since
// it's public.

export const ROUTE_ROLES = {
  'POST /api/v1/qrcode': ['EMPLOYEE'],
  'POST /api/v1/qrcode/resolve': ['ADMIN', 'PARTNER'],
  'GET /api/v1/employees/:id/balance': ['ADMIN', 'COMPANY', 'EMPLOYEE'],
  'GET /api/v1/admin/transactions.csv': ['ADMIN'],

  'GET /api/v1/employeurs': ['ADMIN', 'COMPANY'],
  'POST /api/v1/employeurs': ['ADMIN'],
  'PATCH /api/v1/employeurs/:employeurId': ['ADMIN', 'COMPANY'],
  'DELETE /api/v1/employeurs/:employeurId': ['ADMIN'],
  'POST /api/v1/employeurs/:employeurId/abondements': ['ADMIN', 'COMPANY'],

  'GET /api/v1/salaries': ['ADMIN', 'COMPANY'],
  'POST /api/v1/salaries': ['ADMIN', 'COMPANY'],
  'PATCH /api/v1/salaries/:salarieId': ['ADMIN', 'COMPANY', 'EMPLOYEE'],
  'DELETE /api/v1/salaries/:salarieId': ['ADMIN', 'COMPANY'],
  'GET /api/v1/salaries/:salarieId': ['ADMIN', 'COMPANY', 'EMPLOYEE'],
  'GET /api/v1/salaries/:salarieId/transactions': ['ADMIN', 'COMPANY', 'EMPLOYEE'],
  'POST /api/v1/salaries/:salarieId/transactions': ['ADMIN', 'COMPANY', 'PARTNER'],

  'GET /api/v1/partenaires': ['ADMIN', 'PARTNER', 'COMPANY', 'EMPLOYEE'],
  'POST /api/v1/partenaires': ['ADMIN'],
  'PATCH /api/v1/partenaires/:partenaireId': ['ADMIN', 'PARTNER'],
  'DELETE /api/v1/partenaires/:partenaireId': ['ADMIN'],
  'GET /api/v1/partenaires/:partenaireId/transactions': ['ADMIN', 'PARTNER'],

  'POST /api/v1/admin/ban': ['ADMIN'],
  'GET /api/v1/admin/employeurs/:id/kbis': ['ADMIN'],

  'GET /api/v1/me': ['ADMIN', 'COMPANY', 'EMPLOYEE', 'PARTNER'],
  'PATCH /api/v1/me': ['ADMIN', 'COMPANY', 'EMPLOYEE', 'PARTNER'],
  'DELETE /api/v1/me': ['ADMIN', 'COMPANY', 'EMPLOYEE', 'PARTNER'],
} as const;

export type RouteKey = keyof typeof ROUTE_ROLES;
