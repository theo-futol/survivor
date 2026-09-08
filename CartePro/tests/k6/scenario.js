import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, USER_EMAIL, USER_PASSWORD } from './config.js';

const healthDuration = new Trend('health_duration', true);
const categoriesDuration = new Trend('categories_duration', true);
const loginDuration = new Trend('login_duration', true);

const jsonParams = {
  headers: { 'Content-Type': 'application/json' },
};

/**
 * One simulated visitor: the public read endpoints, plus a login round-trip
 * when credentials are provided. Shared by every load profile in this folder
 * so they only differ by their stages and thresholds.
 *
 * @param {number} thinkTime seconds to idle at the end of the iteration.
 */
export function visitorFlow(thinkTime = 1)
{
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
    });
  }

  // Think time: keeps the generated load closer to real traffic than a
  // tight request loop would.
  sleep(thinkTime);
}
