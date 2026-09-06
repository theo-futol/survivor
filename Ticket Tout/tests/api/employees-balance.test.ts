import { GET } from '@/app/api/v1/employees/[id]/balance/route';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb } from '../mocks/mock-db';
import {
  ADMIN_ID,
  COMPANY_USER_ID,
  EMPLOYEE_ID,
  OTHER_COMPANY_USER_ID,
  PARTNER_USER_ID,
  UNKNOWN_ID,
} from '../mocks/fixtures';

function headersFor(token?: string)
{
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token)
  {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

function get(id: string, token?: string)
{
  const request = new Request(`http://localhost/api/v1/employees/${id}/balance`, {
    headers: headersFor(token),
  });

  return GET(request, { params: Promise.resolve({ id }) });
}

describe('GET /api/v1/employees/{id}/balance', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 401 without a token', async () =>
  {
    expect((await get(EMPLOYEE_ID)).status).toBe(401);
  });

  it('returns 403 for a role that is not allowed at all', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await get(EMPLOYEE_ID, token)).status).toBe(403);
  });

  it('returns 400 for a non-uuid identifier', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await get('not-a-uuid', token)).status).toBe(400);
  });

  it('returns 404 for an unknown employee', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await get(UNKNOWN_ID, token)).status).toBe(404);
  });

  it('returns 403 when a company reads an employee of another company', async () =>
  {
    const { token } = await signToken({ sub: OTHER_COMPANY_USER_ID, role: 'COMPANY' });

    expect((await get(EMPLOYEE_ID, token)).status).toBe(403);
  });

  it('returns 403 when an employee reads someone else', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });

    expect((await get(ADMIN_ID, token)).status).toBe(403);
  });

  it('returns the balance to an admin', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await get(EMPLOYEE_ID, token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ balance: 1000 });
  });

  it('returns the balance to the employing company', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });
    const response = await get(EMPLOYEE_ID, token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ balance: 1000 });
  });

  it('returns the balance to the employee themselves', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });
    const response = await get(EMPLOYEE_ID, token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ balance: 1000 });
  });
});
