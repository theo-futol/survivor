import { GET, POST } from '@/app/api/v1/ministerfavorite/route';
import { DELETE, PATCH } from '@/app/api/v1/ministerfavorite/[partnerId]/route';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb } from '../mocks/mock-db';
import { ADMIN_ID, COMPANY_USER_ID, EMPLOYER_COMPANY_ID, PARTNER_COMPANY_ID, UNKNOWN_ID } from '../mocks/fixtures';

const URL = 'http://localhost/api/v1/ministerfavorite';

function headersFor(token?: string)
{
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token)
  {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

function get(token?: string)
{
  return GET(new Request(URL, { headers: headersFor(token) }));
}

function post(body: unknown, token?: string)
{
  return POST(new Request(URL, { method: 'POST', headers: headersFor(token), body: JSON.stringify(body) }));
}

function patch(partnerId: string, token?: string)
{
  const request = new Request(`${URL}/${partnerId}`, { method: 'PATCH', headers: headersFor(token) });

  return PATCH(request, { params: Promise.resolve({ partnerId }) });
}

function remove(partnerId: string, token?: string)
{
  const request = new Request(`${URL}/${partnerId}`, { method: 'DELETE', headers: headersFor(token) });

  return DELETE(request, { params: Promise.resolve({ partnerId }) });
}

describe('GET /api/v1/ministerfavorite', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 401 without a token', async () =>
  {
    expect((await get()).status).toBe(401);
  });

  it('returns 403 for a non-admin caller', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });

    expect((await get(token)).status).toBe(403);
  });

  it('returns the favorites with the partner name', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await get(token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.favorites).toEqual([
      { partnerId: PARTNER_COMPANY_ID, name: 'Partenaire SARL', likeAmount: 4 },
    ]);
  });
});

describe('POST /api/v1/ministerfavorite', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 400 for a non-uuid partnerId', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post({ partnerId: 'nope' }, token)).status).toBe(400);
  });

  it('returns 404 for an unknown partner', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post({ partnerId: UNKNOWN_ID }, token)).status).toBe(404);
  });

  it('returns 404 when the company is not a partner', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post({ partnerId: EMPLOYER_COMPANY_ID }, token)).status).toBe(404);
  });

  it('returns 409 when the partner is already a favorite', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post({ partnerId: PARTNER_COMPANY_ID }, token)).status).toBe(409);
  });

  it('adds a partner to the favorites', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    await remove(PARTNER_COMPANY_ID, token);

    const response = await post({ partnerId: PARTNER_COMPANY_ID }, token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ status: 'added', partnerId: PARTNER_COMPANY_ID });
  });
});

describe('PATCH & DELETE /api/v1/ministerfavorite/{partnerId}', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 404 when the partner is not in the list', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await remove(UNKNOWN_ID, token)).status).toBe(404);
  });

  it('removes the favorite through DELETE', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await remove(PARTNER_COMPANY_ID, token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'removed', partnerId: PARTNER_COMPANY_ID });
    expect((await (await get(token)).json()).favorites).toHaveLength(0);
  });

  it('removes the favorite through PATCH as well', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await patch(PARTNER_COMPANY_ID, token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'removed', partnerId: PARTNER_COMPANY_ID });
  });
});
