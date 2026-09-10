import { GET, POST } from '@/app/api/v1/partenaires/route';
import { DELETE, PATCH } from '@/app/api/v1/partenaires/[partenaireId]/route';
import { signToken } from '@/lib/services/auth_service';
import { mockTables, resetMockDb } from '../mocks/mock-db';
import { failNextEmail, resetMockEmail, sentEmails } from '../mocks/mock-email';
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
  description: 'Partenaire de test.',
  address: '5 rue E',
  postalCode: '75005',
  agentId: ADMIN_ID,
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

  it('returns 404 for an unknown category', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await get('?categorie=Inconnue', token)).status).toBe(404);
  });

  it('lets a PARTNER caller browse the network when it opts in with network=true', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });
    const json = await (await get('?network=true', token)).json();

    expect(json.data.length).toBeGreaterThan(1);
    expect(json.data.every((partner: { verified: boolean }) => partner.verified === true)).toBe(true);
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

  it('creates the partner unverified even when the body asks for verified', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const json = await (await post({ ...validBody, verified: true }, token)).json();

    expect(json.verified).toBe(false);
  });
});

// The partner fixture starts verified, so the validation cases first send it
// back to unverified — the state a registration actually leaves it in.
describe('PATCH /api/v1/partenaires/{partenaireId} — administrative validation', () =>
{
  beforeEach(() =>
  {
    resetMockDb();
    resetMockEmail();
  });

  async function unverify()
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    await patch(PARTNER_COMPANY_ID, { verified: false }, token);
    resetMockEmail();
  }

  function accountStatusOf(userId: string)
  {
    return mockTables['Users']!.find((row) => row['id'] === userId)!['accountStatus'];
  }

  it('verifies the partner and mails it a validation notice', async () =>
  {
    await unverify();

    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await patch(PARTNER_COMPANY_ID, { verified: true }, token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.verified).toBe(true);

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]!.to).toBe('partenaire@example.com');
    expect(sentEmails[0]!.text).toContain('http://localhost:3000/login');
    expect(sentEmails[0]!.text).toContain('Démonstrateur technique, ne constitue pas un service public en exploitation.');
  });

  it('leaves the partner unverified when the mail cannot be sent', async () =>
  {
    await unverify();

    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    failNextEmail();

    expect((await patch(PARTNER_COMPANY_ID, { verified: true }, token)).status).toBe(502);

    const json = await (await patch(PARTNER_COMPANY_ID, { name: 'Partenaire SARL' }, token)).json();

    expect(json.verified).toBe(false);
  });

  it('sends nothing when a partner is refused verification', async () =>
  {
    await unverify();

    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await patch(PARTNER_COMPANY_ID, { verified: true }, token)).status).toBe(403);
    expect(sentEmails).toHaveLength(0);
  });

  it('sends nothing when the partner is already verified', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await patch(PARTNER_COMPANY_ID, { verified: true }, token)).status).toBe(200);
    expect(sentEmails).toHaveLength(0);
  });

  // Login only checks accountStatus, so the account registered with the partner
  // has to follow the partner's own validation.
  it('activates and suspends the account registered with the partner', async () =>
  {
    await unverify();

    expect(accountStatusOf(PARTNER_USER_ID)).toBe('PENDING');

    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    await patch(PARTNER_COMPANY_ID, { verified: true }, token);

    expect(accountStatusOf(PARTNER_USER_ID)).toBe('ACCEPTED');

    await patch(PARTNER_COMPANY_ID, { verified: false }, token);

    expect(accountStatusOf(PARTNER_USER_ID)).toBe('PENDING');
  });

  it('leaves the account PENDING when the validation mail cannot be sent', async () =>
  {
    await unverify();

    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    failNextEmail();

    expect((await patch(PARTNER_COMPANY_ID, { verified: true }, token)).status).toBe(502);
    expect(accountStatusOf(PARTNER_USER_ID)).toBe('PENDING');
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

  it('returns 403 when a partner tries to self-verify', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await patch(PARTNER_COMPANY_ID, { verified: true }, token)).status).toBe(403);
  });

  it('lets an admin set verified on a partner', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const json = await (await patch(PARTNER_COMPANY_ID, { verified: true }, token)).json();

    expect(json.verified).toBe(true);
  });

  it('soft-deletes a partner as admin', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await remove(PARTNER_COMPANY_ID, token)).status).toBe(204);

    const json = await (await get('', token)).json();

    expect(json.data.some((partner: { id: string }) => partner.id === PARTNER_COMPANY_ID)).toBe(false);
  });
});

// `active` suspends and reactivates a partner without deleting it, the way
// `DELETE` alone never could once the row disappeared from every read.
describe('PATCH /api/v1/partenaires/{partenaireId} — active toggle', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 403 when a partner tries to set its own active flag', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await patch(PARTNER_COMPANY_ID, { active: false }, token)).status).toBe(403);
  });

  it('suspends the partner and hides it from the default listing', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await patch(PARTNER_COMPANY_ID, { active: false }, token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.active).toBe(false);

    const listed = await (await get('', token)).json();

    expect(listed.data.some((partner: { id: string }) => partner.id === PARTNER_COMPANY_ID)).toBe(false);
  });

  it('keeps a suspended partner visible to an admin passing includeInactive=true', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    await patch(PARTNER_COMPANY_ID, { active: false }, token);

    const listed = await (await get('?includeInactive=true', token)).json();
    const found = listed.data.find((partner: { id: string }) => partner.id === PARTNER_COMPANY_ID);

    expect(found?.active).toBe(false);
  });

  it('reactivates a suspended partner, restoring it to the default listing', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    await patch(PARTNER_COMPANY_ID, { active: false }, token);

    const response = await patch(PARTNER_COMPANY_ID, { active: true }, token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.active).toBe(true);

    const listed = await (await get('', token)).json();

    expect(listed.data.some((partner: { id: string }) => partner.id === PARTNER_COMPANY_ID)).toBe(true);
  });
});
