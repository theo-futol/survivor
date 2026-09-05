import { GET, POST } from '@/app/api/v1/employeurs/route';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb } from '../mocks/mock-db';
import { ADMIN_ID, COMPANY_USER_ID, EMPLOYEE_ID, EMPLOYER_COMPANY_ID, FREE_DOCUMENT_ID } from '../mocks/fixtures';

const URL = 'http://localhost/api/v1/employeurs';

function headersFor(token?: string)
{
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token)
  {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

function get(query = '', token?: string)
{
  return GET(new Request(`${URL}${query}`, { headers: headersFor(token) }));
}

function post(body: unknown, token?: string)
{
  return POST(new Request(URL, { method: 'POST', headers: headersFor(token), body: JSON.stringify(body) }));
}

const validBody = {
  name: 'Nouvelle SA',
  email: 'nouvelle@example.com',
  siret: '44444444444444',
  kbisId: FREE_DOCUMENT_ID,
  address: '4 rue D',
  postalCode: '75004',
  agentId: 1,
  reasonId: 1,
  categoryId: 1,
  location: { lat: 48.85, lng: 2.35 },
};

describe('GET /api/v1/employeurs', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 401 without a token', async () =>
  {
    expect((await get()).status).toBe(401);
  });

  it('returns 403 for a role that is not allowed', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });

    expect((await get('', token)).status).toBe(403);
  });

  it('returns 400 for invalid pagination', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await get('?page=0', token)).status).toBe(400);
  });

  it('returns every active employer for an admin, partners excluded', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await get('', token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.meta).toEqual({ page: 1, limit: 20, total: 2 });
    expect(json.data.every((company: { isPartner: boolean }) => company.isPartner === false)).toBe(true);
  });

  it('restricts a COMPANY caller to its own employer', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });
    const response = await get('', token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe(EMPLOYER_COMPANY_ID);
  });

  it('filters on the search term', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await get('?search=Entreprise', token);
    const json = await response.json();

    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe('Entreprise SA');
  });
});

describe('POST /api/v1/employeurs', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 401 without a token', async () =>
  {
    expect((await post(validBody)).status).toBe(401);
  });

  it('returns 403 for a COMPANY caller', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });

    expect((await post(validBody, token)).status).toBe(403);
  });

  it('returns 400 when a database-required field is missing', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const { categoryId: _omitted, ...incomplete } = validBody;

    expect((await post(incomplete, token)).status).toBe(400);
  });

  it('returns 400 for a malformed siret', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post({ ...validBody, siret: '123' }, token)).status).toBe(400);
  });

  it('returns 409 when the siret already exists', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post({ ...validBody, siret: '11111111111111' }, token)).status).toBe(409);
  });

  it('creates the employer with isPartner false and active true', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await post(validBody, token);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.isPartner).toBe(false);
    expect(json.active).toBe(true);
    expect(json.name).toBe('Nouvelle SA');
  });
});
