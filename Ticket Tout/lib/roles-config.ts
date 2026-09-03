// Maps each protected endpoint (method + path, as documented in docs/API.md)
// to the roles allowed to call it. Extend this map whenever a new protected
// route handler is added; POST /api/v1/login is intentionally absent since
// it's public.

export const ROUTE_ROLES = {
  'POST /api/v1/qrcode': ['EMPLOYEE'],
} as const;

export type RouteKey = keyof typeof ROUTE_ROLES;
