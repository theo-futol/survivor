import { GET, POST } from '@/app/api/v1/partenaires/route';
import { DELETE, PATCH } from '@/app/api/v1/partenaires/[partenaireId]/route';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb } from '../mocks/mock-db';
import {
  ADMIN_ID,
  EMPLOYER_COMPANY_ID,
  FREE_DOCUMENT_ID,
  PARTNER_COMPANY_ID,
  PARTNER_USER_ID,
  UNKNOWN_ID,
} from '../mocks/fixtures';

const URL = 'http://localhost/api/v1/partenaires';

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

function patch(partenaireId: string, body: unknown, token?: string)
{
  const request = new Request(`${URL}/${partenaireId}`, {
    method: 'PATCH',
    headers: headersFor(token),
    body: JSON.stringify(body),
  });

  return PATCH(request, { params: Promise.resolve({ partenaireId }) });
}

function remove(partenaireId: string, token?: string)
{
  const request = new Request(`${URL}/${partenaireId}`, { method: 'DELETE', headers: headersFor(token) });

  return DELETE(request, { params: Promise.resolve({ partenaireId }) });
}

const validBody = {
  name: 'Nouveau Partenaire',
  email: 'nouveau-partenaire@example.com',
  siret: '55555555555555',
  kbisId: FREE_DOCUMENT_ID,
  address: '5 rue E',
  postalCode: '75005',
  agentId: 1,
  reasonId: 1,
  categoryId: 2,
  location: { lat: 48.85, lng: 2.35 },
};

describe('GET /api/v1/partenaires', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 401 without a token', async () =>
  {
    expect((await get()).status).toBe(401);
  });

  it('returns only partners, with the company category included', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await get('', token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.every((partner: { isPartner: boolean }) => partner.isPartner === true)).toBe(true);
    expect(json.data[0].category).toEqual({ id: 1, category: 'Restauration' });
  });

  it('restricts a PARTNER caller to its own profile', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });
    const json = await (await get('', token)).json();

    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe(PARTNER_COMPANY_ID);
  });

  it('filters on featured', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const json = await (await get('?featured=false', token)).json();

    expect(json.data.every((partner: { isFeatured: boolean }) => partner.isFeatured === false)).toBe(true);
  });

  it('returns 404 for an unknown category', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await get('?categorie=Inconnue', token)).status).toBe(404);
  });
});

describe('POST /api/v1/partenaires', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 403 for a PARTNER caller', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await post(validBody, token)).status).toBe(403);
  });

  it('creates the partner with isPartner true', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await post(validBody, token);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.isPartner).toBe(true);
  });
});

describe('PATCH & DELETE /api/v1/partenaires/{partenaireId}', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 403 when a PARTNER caller targets another partner', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await patch(UNKNOWN_ID, { name: 'X' }, token)).status).toBe(403);
  });

  it('returns 404 when the id belongs to an employer, not a partner', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await patch(EMPLOYER_COMPANY_ID, { name: 'X' }, token)).status).toBe(404);
  });

  it('lets a partner update its own profile', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });
    const json = await (await patch(PARTNER_COMPANY_ID, { name: 'Partenaire SAS' }, token)).json();

    expect(json.name).toBe('Partenaire SAS');
  });

  it('soft-deletes a partner as admin', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await remove(PARTNER_COMPANY_ID, token)).status).toBe(204);

    const json = await (await get('', token)).json();

    expect(json.data.some((partner: { id: string }) => partner.id === PARTNER_COMPANY_ID)).toBe(false);
  });
});
