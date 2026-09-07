// Maps each protected endpoint (method + path) to the roles allowed to call it.
// POST /api/v1/login and POST /api/v1/signup stay public and are intentionally absent.

export const ROUTE_ROLES = {
  'GET /api/v1/me': ['EMPLOYEE', 'COMPANY', 'PARTNER', 'ADMIN'],

  'POST /api/v1/qrcode': ['EMPLOYEE'],
  'GET /api/v1/employees/:id/balance': ['ADMIN', 'COMPANY', 'EMPLOYEE'],
  'GET /api/v1/admin/transactions.csv': ['ADMIN'],
  'GET /api/v1/admin/employeurs/:id/kbis': ['ADMIN'],

  'GET /api/v1/employeurs': ['ADMIN', 'COMPANY'],
  'POST /api/v1/employeurs': ['ADMIN'],
  'PATCH /api/v1/employeurs/:employeurId': ['ADMIN', 'COMPANY'],
  'DELETE /api/v1/employeurs/:employeurId': ['ADMIN'],
  'POST /api/v1/employeurs/:employeurId/abondements': ['ADMIN', 'COMPANY'],

  'GET /api/v1/salaries': ['ADMIN', 'COMPANY'],
  'POST /api/v1/salaries': ['ADMIN', 'COMPANY'],
  'GET /api/v1/salaries/:salarieId': ['ADMIN', 'COMPANY', 'EMPLOYEE'],
  'PATCH /api/v1/salaries/:salarieId': ['ADMIN', 'COMPANY', 'EMPLOYEE'],
  'DELETE /api/v1/salaries/:salarieId': ['ADMIN', 'COMPANY'],
  'GET /api/v1/salaries/:salarieId/transactions': ['ADMIN', 'COMPANY', 'EMPLOYEE'],
  // A salarié never initiates their own movement: a partner charges them, the
  // employer or an admin corrects them.
  'POST /api/v1/salaries/:salarieId/transactions': ['ADMIN', 'COMPANY', 'PARTNER'],

  'GET /api/v1/partenaires': ['ADMIN', 'PARTNER', 'EMPLOYEE'],
  'POST /api/v1/partenaires': ['ADMIN'],
  'PATCH /api/v1/partenaires/:partenaireId': ['ADMIN', 'PARTNER'],
  'DELETE /api/v1/partenaires/:partenaireId': ['ADMIN'],
  'GET /api/v1/partenaires/:partenaireId/transactions': ['ADMIN'],

  'POST /api/v1/admin/ban': ['ADMIN'],

  'GET /api/v1/ministerfavorite': ['ADMIN', 'EMPLOYEE'],
  'POST /api/v1/ministerfavorite': ['ADMIN'],
  'PATCH /api/v1/ministerfavorite/:partnerId': ['ADMIN'],
  'DELETE /api/v1/ministerfavorite/:partnerId': ['ADMIN'],

  'GET /api/v1/featuredpartner': ['ADMIN'],
  'POST /api/v1/featuredpartner': ['ADMIN'],
  'PATCH /api/v1/featuredpartner/:highlightId': ['ADMIN'],
} as const;

export type RouteKey = keyof typeof ROUTE_ROLES;
