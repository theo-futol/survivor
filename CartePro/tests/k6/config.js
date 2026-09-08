/**
 * Shared configuration for the k6 load tests.
 *
 * Everything is overridable through environment variables so the same scripts
 * can target a local dev server, a staging deployment, or CI:
 *
 *   k6 run -e BASE_URL=https://localhost:3000 stress.js
 */

/** Base URL of the running CartePro instance. */
export const BASE_URL = (__ENV.BASE_URL || 'https://localhost:3000').replace(/\/$/, '');

/** Optional credentials — when both are set, the login flow is exercised too. */
export const USER_EMAIL = __ENV.K6_EMAIL || '';
export const USER_PASSWORD = __ENV.K6_PASSWORD || '';

/**
 * `next dev` serves HTTPS with a self-signed certificate (see the `dev` script
 * in package.json), so certificate validation has to be relaxed locally.
 */
const shared = {
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
};

/* ------------------------------------------------------------------ *
 * Stress profile — warm up, push past the expected load, ramp down.
 * ------------------------------------------------------------------ */

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

export const options = {
  ...shared,
  stages,
  thresholds,
};

/* ------------------------------------------------------------------ *
 * Average-load profile — typical day-to-day traffic, held long enough
 * for the system to reach a steady state.
 * ------------------------------------------------------------------ */

export const averageLoadStages = [
  { duration: __ENV.AVG_RAMP_UP || '1m', target: Number(__ENV.AVG_VUS || 20) },
  { duration: __ENV.AVG_DURATION || '5m', target: Number(__ENV.AVG_VUS || 20) },
  { duration: __ENV.AVG_RAMP_DOWN || '1m', target: 0 },
];

/**
 * Stricter than the stress thresholds on purpose: under normal load the API is
 * expected to be comfortable, so a p(95) above 500 ms or any noticeable error
 * rate is a regression rather than an acceptable degradation.
 */
export const averageLoadThresholds = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  checks: ['rate>0.99'],
};

export const averageLoadOptions = {
  ...shared,
  stages: averageLoadStages,
  thresholds: averageLoadThresholds,
};
