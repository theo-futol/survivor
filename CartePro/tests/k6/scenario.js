import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, USER_EMAIL, USER_PASSWORD } from './config.js';

const healthDuration = new Trend('health_duration', true);
const categoriesDuration = new Trend('categories_duration', true);
const loginDuration = new Trend('login_duration', true);
const qrcodeDuration = new Trend('qrcode_duration', true);

// POST /api/v1/qrcode answers 201 when it inserts a new code and 200 when it
// hands back one that is still valid, so the split between these two counters
// is what tells how much write load the run actually produced.
const qrcodeMinted = new Counter('qrcode_minted');
const qrcodeReused = new Counter('qrcode_reused');

const jsonParams = {
  headers: { 'Content-Type': 'application/json' },
};

/**
 * Run once per test, before the VUs start: logs in and collects the partner
 * companies a QR code can be issued for. Returned value is handed to every
 * iteration of `visitorFlow`.
 *
 * Failures are not fatal — an empty list simply disables the `qrcode` group so
 * the rest of the scenario keeps running against a target without seed data.
 *
 * @returns {{ companyIds: string[] }}
 */
export function setupQrContext()
{
  if (!USER_EMAIL || !USER_PASSWORD)
  {
    return { companyIds: [] };
  }

  const payload = JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD });
  const login = http.post(`${BASE_URL}/api/v1/login`, payload, jsonParams);
  const token = login.json('token');

  if (login.status !== 200 || typeof token !== 'string')
  {
    console.warn(`setup: login failed (${login.status}), qrcode group disabled`);
    return { companyIds: [] };
  }

  const res = http.get(`${BASE_URL}/api/v1/partenaires?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = res.json('data');

  if (res.status !== 200 || !Array.isArray(data))
  {
    console.warn(`setup: partner listing failed (${res.status}), qrcode group disabled`);
    return { companyIds: [] };
  }

  const companyIds = data.map((company) => company.id);

  console.log(`setup: ${companyIds.length} companies available for QR generation`);

  return { companyIds };
}

/**
 * One simulated visitor: the public read endpoints, a login round-trip when
 * credentials are provided, then a QR code generation reusing that login's
 * token. Shared by every load profile in this folder so they only differ by
 * their stages and thresholds.
 *
 * @param {{ companyIds: string[] }} ctx value returned by `setupQrContext`.
 * @param {number} thinkTime seconds to idle at the end of the iteration.
 */
export function visitorFlow(ctx = { companyIds: [] }, thinkTime = 1)
{
  let token = null;
  let userId = null;

  group('health', () =>
  {
    const res = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health' } });

    healthDuration.add(res.timings.duration);
    check(res, {
      'health: status is 200': (r) => r.status === 200,
      'health: returns a version': (r) => typeof r.json('version') === 'string',
    });
  });

  group('categories', () =>
  {
    const res = http.get(`${BASE_URL}/api/v1/categories`, { tags: { endpoint: 'categories' } });

    categoriesDuration.add(res.timings.duration);
    check(res, {
      'categories: status is 200': (r) => r.status === 200,
      'categories: returns an array': (r) => Array.isArray(r.json('categories')),
    });
  });

  if (USER_EMAIL && USER_PASSWORD)
  {
    group('login', () =>
    {
      const payload = JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD });
      const res = http.post(`${BASE_URL}/api/v1/login`, payload, {
        ...jsonParams,
        tags: { endpoint: 'login' },
      });

      loginDuration.add(res.timings.duration);
      check(res, {
        'login: status is 200': (r) => r.status === 200,
        'login: returns a token': (r) => typeof r.json('token') === 'string',
      });

      if (res.status === 200)
      {
        token = res.json('token');
        // The route rejects a body whose userId is not the token subject, so
        // the id has to come from the login response, never from config.
        userId = res.json('user.id');
      }
    });
  }

  const companyIds = ctx && Array.isArray(ctx.companyIds) ? ctx.companyIds : [];

  if (token && userId && companyIds.length > 0)
  {
    group('qrcode', () =>
    {
      // A valid QR code is reused for a given (userId, companyId) pair, so
      // spreading the VUs over distinct companies is what keeps the endpoint
      // actually minting codes instead of replaying the same one.
      const companyId = companyIds[(__VU - 1) % companyIds.length];
      const payload = JSON.stringify({ companyId, userId });
      const res = http.post(`${BASE_URL}/api/v1/qrcode`, payload, {
        headers: { ...jsonParams.headers, Authorization: `Bearer ${token}` },
        tags: { endpoint: 'qrcode' },
      });

      qrcodeDuration.add(res.timings.duration);

      if (res.status === 201)
      {
        qrcodeMinted.add(1);
      }
      else if (res.status === 200)
      {
        qrcodeReused.add(1);
      }

      check(res, {
        'qrcode: status is 200 or 201': (r) => r.status === 200 || r.status === 201,
        'qrcode: returns a 64-hex code': (r) => /^[0-9a-f]{64}$/.test(r.json('qrcode') || ''),
        'qrcode: returns an expiry': (r) => typeof r.json('expiresAt') === 'string',
      });
    });
  }

  // Think time: keeps the generated load closer to real traffic than a
  // tight request loop would.
  sleep(thinkTime);
}
