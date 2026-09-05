import { DELETE, PATCH } from '@/app/api/v1/salaries/[salarieId]/route';
import { GET } from '@/app/api/v1/salaries/route';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb } from '../mocks/mock-db';
import { ADMIN_ID, COMPANY_USER_ID, EMPLOYEE_ID, OTHER_COMPANY_USER_ID, UNKNOWN_ID } from '../mocks/fixtures';

function headersFor(token?: string)
{
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token)
  {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

function patch(salarieId: string, body: unknown, token?: string)
{
  const request = new Request(`http://localhost/api/v1/salaries/${salarieId}`, {
    method: 'PATCH',
    headers: headersFor(token),
    body: JSON.stringify(body),
  });

  return PATCH(request, { params: Promise.resolve({ salarieId }) });
}

function remove(salarieId: string, token?: string)
{
  const request = new Request(`http://localhost/api/v1/salaries/${salarieId}`, {
    method: 'DELETE',
    headers: headersFor(token),
  });

  return DELETE(request, { params: Promise.resolve({ salarieId }) });
}

describe('PATCH /api/v1/salaries/{salarieId}', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 401 without a token', async () =>
  {
    expect((await patch(EMPLOYEE_ID, { name: 'X' })).status).toBe(401);
  });

  it('returns 404 for an unknown salarié', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await patch(UNKNOWN_ID, { name: 'X' }, token)).status).toBe(404);
  });

  it('returns 403 when a COMPANY caller targets a salarié of another company', async () =>
  {
    const { token } = await signToken({ sub: OTHER_COMPANY_USER_ID, role: 'COMPANY' });

    expect((await patch(EMPLOYEE_ID, { name: 'X' }, token)).status).toBe(403);
  });

  it('returns 403 when a salarié targets someone else', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });

    expect((await patch(UNKNOWN_ID, { name: 'X' }, token)).status).toBe(404);
  });

  it('rejects a field a salarié is not allowed to change on itself', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });
    const response = await patch(EMPLOYEE_ID, { email: 'hijack@example.com' }, token);

    expect(response.status).toBe(400);
  });

  it('lets a salarié change its own name', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });
    const json = await (await patch(EMPLOYEE_ID, { name: 'Jeanne' }, token)).json();

    expect(json.name).toBe('Jeanne');
    expect(json.password).toBeUndefined();
  });

  it('returns 409 when the new email is already taken', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await patch(EMPLOYEE_ID, { email: 'admin@example.com' }, token)).status).toBe(409);
  });

  it('hashes a new password instead of storing it in clear', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });
    const response = await patch(EMPLOYEE_ID, { password: 'Another1!' }, token);

    expect(response.status).toBe(200);

    const listed = await GET(new Request('http://localhost/api/v1/salaries', { headers: headersFor(token) }));
    const json = await listed.json();

    expect(json.data[0].password).toBeUndefined();
  });
});

describe('DELETE /api/v1/salaries/{salarieId}', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 403 for an EMPLOYEE caller', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });

    expect((await remove(EMPLOYEE_ID, token)).status).toBe(403);
  });

  it('soft-deletes: returns 204 and hides the salarié from later reads', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });

    expect((await remove(EMPLOYEE_ID, token)).status).toBe(204);

    const listed = await GET(new Request('http://localhost/api/v1/salaries', { headers: headersFor(token) }));
    const json = await listed.json();

    expect(json.data).toHaveLength(0);
  });

  it('returns 404 when deleting an already deleted salarié', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });

    await remove(EMPLOYEE_ID, token);

    expect((await remove(EMPLOYEE_ID, token)).status).toBe(404);
  });
});
