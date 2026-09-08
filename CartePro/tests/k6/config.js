/**
 * Shared configuration for the k6 load tests.
 *
 * Everything is overridable through environment variables so the same script
 * can target a local dev server, a staging deployment, or CI:
 *
 *   k6 run -e BASE_URL=https://localhost:3000 stress.js
 */

/** Base URL of the running CartePro instance. */
export const BASE_URL = (__ENV.BASE_URL || 'https://localhost:3000').replace(/\/$/, '');

/** Optional credentials — when both are set, the login flow is exercised too. */
export const USER_EMAIL = __ENV.K6_EMAIL || '';
export const USER_PASSWORD = __ENV.K6_PASSWORD || '';

/** Ramping profile: warm up, push past the expected load, then ramp back down. */
export const stages = [
  { duration: __ENV.RAMP_UP || '30s', target: Number(__ENV.VUS_LOW || 10) },
  { duration: __ENV.PLATEAU || '1m', target: Number(__ENV.VUS_MID || 50) },
  { duration: __ENV.PEAK || '1m', target: Number(__ENV.VUS_HIGH || 100) },
  { duration: __ENV.RAMP_DOWN || '30s', target: 0 },
];

/** Pass/fail criteria — k6 exits non-zero when any of these are breached. */
export const thresholds = {
  http_req_failed: ['rate<0.05'],
  http_req_duration: ['p(95)<800', 'p(99)<2000'],
  checks: ['rate>0.95'],
};

/**
 * `next dev` serves HTTPS with a self-signed certificate (see the `dev` script
 * in package.json), so certificate validation has to be relaxed locally.
 */
export const options = {
  stages,
  thresholds,
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
};
