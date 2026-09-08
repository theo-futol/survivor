import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from './config.js';

/**
 * Cheapest possible run: a single virtual user, a handful of iterations.
 * Use it to confirm the target is reachable before launching `stress.js`.
 */
export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<1000'],
  },
  insecureSkipTLSVerify: true,
};

export default function ()
{
  const res = http.get(`${BASE_URL}/health`);

  check(res, {
    'health: status is 200': (r) => r.status === 200,
  });
}
