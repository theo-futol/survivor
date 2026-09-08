import { DELETE, PATCH } from '@/app/api/v1/employeurs/[employeurId]/route';
import { GET } from '@/app/api/v1/employeurs/route';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb } from '../mocks/mock-db';
import {
  ADMIN_ID,
  COMPANY_USER_ID,
  EMPLOYER_COMPANY_ID,
  OTHER_COMPANY_ID,
  PARTNER_COMPANY_ID,
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

function patch(employeurId: string, body: unknown, token?: string)
{
  const request = new Request(`http://localhost/api/v1/employeurs/${employeurId}`, {
    method: 'PATCH',
    headers: headersFor(token),
    body: JSON.stringify(body),
  });

  return PATCH(request, { params: Promise.resolve({ employeurId }) });
}

function remove(employeurId: string, token?: string)
{
  const request = new Request(`http://localhost/api/v1/employeurs/${employeurId}`, {
    method: 'DELETE',
    headers: headersFor(token),
  });

  return DELETE(request, { params: Promise.resolve({ employeurId }) });
}

describe('PATCH /api/v1/employeurs/{employeurId}', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 401 without a token', async () =>
  {
    expect((await patch(EMPLOYER_COMPANY_ID, { name: 'X' })).status).toBe(401);
  });

  it('returns 400 for a non-uuid identifier', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await patch('not-a-uuid', { name: 'X' }, token)).status).toBe(400);
  });

  it('returns 400 for an empty patch', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await patch(EMPLOYER_COMPANY_ID, {}, token)).status).toBe(400);
  });

  it('returns 403 when a COMPANY caller targets another company', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });

    expect((await patch(OTHER_COMPANY_ID, { name: 'X' }, token)).status).toBe(403);
  });

  it('returns 404 for an unknown employer', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await patch(UNKNOWN_ID, { name: 'X' }, token)).status).toBe(404);
  });

  it('returns 404 when the id belongs to a partner, not an employer', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await patch(PARTNER_COMPANY_ID, { name: 'X' }, token)).status).toBe(404);
  });

  it('returns 409 when the new email is already taken', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await patch(EMPLOYER_COMPANY_ID, { email: 'autre@example.com' }, token)).status).toBe(409);
  });

  it('updates the employer for its own COMPANY user', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });
    const response = await patch(EMPLOYER_COMPANY_ID, { name: 'Entreprise SAS' }, token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.name).toBe('Entreprise SAS');
  });
});

describe('DELETE /api/v1/employeurs/{employeurId}', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 403 for a COMPANY caller', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });

    expect((await remove(EMPLOYER_COMPANY_ID, token)).status).toBe(403);
  });

  it('returns 404 for an unknown employer', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await remove(UNKNOWN_ID, token)).status).toBe(404);
  });

  it('soft-deletes: returns 204 and hides the employer from later reads', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await remove(EMPLOYER_COMPANY_ID, token)).status).toBe(204);

    const listed = await GET(new Request('http://localhost/api/v1/employeurs', { headers: headersFor(token) }));
    const json = await listed.json();

    expect(json.data.some((company: { id: string }) => company.id === EMPLOYER_COMPANY_ID)).toBe(false);
  });
});
