import { POST } from '@/app/api/v1/admin/ban/route';
import { GET } from '@/app/api/v1/salaries/route';
import { signToken } from '@/lib/services/auth_service';
import { isBanned } from '@/lib/services/redis_service';
import { resetMockRedis } from '../mocks/mock-redis';
import { resetMockDb } from '../mocks/mock-db';
import { ADMIN_ID, COMPANY_USER_ID, EMPLOYEE_ID, UNKNOWN_ID } from '../mocks/fixtures';

const URL = 'http://localhost/api/v1/admin/ban';

function headersFor(token?: string)
{
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token)
  {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

function post(body: unknown, token?: string)
{
  return POST(new Request(URL, { method: 'POST', headers: headersFor(token), body: JSON.stringify(body) }));
}

describe('POST /api/v1/admin/ban', () =>
{
  beforeEach(() =>
  {
    resetMockDb();
    resetMockRedis();
  });

  it('returns 401 without a token', async () =>
  {
    expect((await post({ userId: EMPLOYEE_ID, reason: 'Violation' })).status).toBe(401);
  });

  it('returns 403 for a COMPANY caller', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });

    expect((await post({ userId: EMPLOYEE_ID, reason: 'Violation' }, token)).status).toBe(403);
  });

  it('returns 400 when the reason is missing', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post({ userId: EMPLOYEE_ID }, token)).status).toBe(400);
  });

  it('returns 404 for an unknown user', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post({ userId: UNKNOWN_ID, reason: 'Violation' }, token)).status).toBe(404);
  });

  it('bans the user in both the table and redis, and surfaces it on the salariés list', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await post({ userId: EMPLOYEE_ID, reason: 'Violation of terms' }, token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ status: 'banned', userId: EMPLOYEE_ID, reason: 'Violation of terms' });
    expect(await isBanned(EMPLOYEE_ID)).toBe(true);

    const listed = await GET(new Request('http://localhost/api/v1/salaries', { headers: headersFor(token) }));
    const salaries = await listed.json();

    expect(salaries.data.find((s: { id: string }) => s.id === EMPLOYEE_ID).isBanned).toBe(true);
  });

  it('returns 409 when the user is already banned', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    await post({ userId: EMPLOYEE_ID, reason: 'Violation' }, token);

    expect((await post({ userId: EMPLOYEE_ID, reason: 'Violation' }, token)).status).toBe(409);
  });

  it('revokes the banned user own token on the next request', async () =>
  {
    const { token: adminToken } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const { token: employeeToken } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });

    await post({ userId: EMPLOYEE_ID, reason: 'Violation' }, adminToken);

    const blocked = await GET(new Request('http://localhost/api/v1/salaries', { headers: headersFor(employeeToken) }));

    expect(blocked.status).toBe(403);
  });
});
