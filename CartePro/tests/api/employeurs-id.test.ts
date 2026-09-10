import { DELETE, PATCH } from '@/app/api/v1/employeurs/[employeurId]/route';
import { GET } from '@/app/api/v1/employeurs/route';
import { signToken } from '@/lib/services/auth_service';
import { mockTables, resetMockDb } from '../mocks/mock-db';
import { failNextEmail, resetMockEmail, sentEmails } from '../mocks/mock-email';
import {
  ADMIN_ID,
  COMPANY_USER_ID,
  EMPLOYER_COMPANY_ID,
  PENDING_EMPLOYEE_ID,
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

// Every company fixture starts verified, so each case first sends the employer
// back to unverified — the state a registration actually leaves it in — and then
// exercises the validation itself.
describe('PATCH /api/v1/employeurs/{employeurId} — administrative validation', () =>
{
  beforeEach(() =>
  {
    resetMockDb();
    resetMockEmail();
  });

  async function unverify()
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    await patch(EMPLOYER_COMPANY_ID, { verified: false }, token);
    resetMockEmail();
  }

  function accountStatusOf(userId: string)
  {
    return mockTables['Users']!.find((row) => row['id'] === userId)!['accountStatus'];
  }

  it('returns 403 when a COMPANY caller tries to verify its own company', async () =>
  {
    await unverify();

    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });
    const response = await patch(EMPLOYER_COMPANY_ID, { verified: true }, token);

    expect(response.status).toBe(403);
    expect(sentEmails).toHaveLength(0);
  });

  it('verifies the employer and mails it a validation notice', async () =>
  {
    await unverify();

    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await patch(EMPLOYER_COMPANY_ID, { verified: true }, token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.verified).toBe(true);

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]!.to).toBe('employer@example.com');
    expect(sentEmails[0]!.text).toContain('http://localhost:3000/login');
    expect(sentEmails[0]!.text).toContain('Démonstrateur technique, ne constitue pas un service public en exploitation.');
  });

  it('leaves the employer unverified when the mail cannot be sent', async () =>
  {
    await unverify();

    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    failNextEmail();

    expect((await patch(EMPLOYER_COMPANY_ID, { verified: true }, token)).status).toBe(502);

    const json = await (await patch(EMPLOYER_COMPANY_ID, { name: 'Entreprise SA' }, token)).json();

    expect(json.verified).toBe(false);
  });

  it('sends nothing when the employer is already verified', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await patch(EMPLOYER_COMPANY_ID, { verified: true }, token)).status).toBe(200);
    expect(sentEmails).toHaveLength(0);
  });

  it('sends nothing for an ordinary patch', async () =>
  {
    await unverify();

    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    await patch(EMPLOYER_COMPANY_ID, { name: 'Entreprise SA' }, token);

    expect(sentEmails).toHaveLength(0);
  });

  // Login only checks accountStatus, so the account registered with the company
  // has to follow the company's own validation.
  it('activates the account registered with the company', async () =>
  {
    await unverify();

    expect(accountStatusOf(COMPANY_USER_ID)).toBe('PENDING');

    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    await patch(EMPLOYER_COMPANY_ID, { verified: true }, token);

    expect(accountStatusOf(COMPANY_USER_ID)).toBe('ACCEPTED');
  });

  it('leaves the employees of the company to their own verification', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    await patch(EMPLOYER_COMPANY_ID, { verified: false }, token);
    await patch(EMPLOYER_COMPANY_ID, { verified: true }, token);

    expect(accountStatusOf(PENDING_EMPLOYEE_ID)).toBe('PENDING');
  });

  it('suspends the account again when the validation is revoked', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    await patch(EMPLOYER_COMPANY_ID, { verified: false }, token);

    expect(accountStatusOf(COMPANY_USER_ID)).toBe('PENDING');
  });

  // Repairs a validation whose account update did not land: no second email,
  // but the account status is written again.
  it('re-applies the account status on an already-verified company', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    mockTables['Users']!.find((row) => row['id'] === COMPANY_USER_ID)!['accountStatus'] = 'PENDING';

    expect((await patch(EMPLOYER_COMPANY_ID, { verified: true }, token)).status).toBe(200);
    expect(sentEmails).toHaveLength(0);
    expect(accountStatusOf(COMPANY_USER_ID)).toBe('ACCEPTED');
  });

  it('leaves the account PENDING when the validation mail cannot be sent', async () =>
  {
    await unverify();

    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    failNextEmail();

    expect((await patch(EMPLOYER_COMPANY_ID, { verified: true }, token)).status).toBe(502);
    expect(accountStatusOf(COMPANY_USER_ID)).toBe('PENDING');
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

// `active` suspends and reactivates a company without deleting it, the way
// `DELETE` alone never could once the row disappeared from every read.
describe('PATCH /api/v1/employeurs/{employeurId} — active toggle', () =>
{
  beforeEach(() => resetMockDb());

  function listAsAdmin(token: string, includeInactive = false)
  {
    const suffix = includeInactive ? '?includeInactive=true' : '';

    return GET(new Request(`http://localhost/api/v1/employeurs${suffix}`, { headers: headersFor(token) }));
  }

  it('returns 403 when a COMPANY caller tries to set its own active flag', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });

    expect((await patch(EMPLOYER_COMPANY_ID, { active: false }, token)).status).toBe(403);
  });

  it('suspends the employer and hides it from the default listing', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await patch(EMPLOYER_COMPANY_ID, { active: false }, token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.active).toBe(false);

    const listed = await (await listAsAdmin(token)).json();

    expect(listed.data.some((company: { id: string }) => company.id === EMPLOYER_COMPANY_ID)).toBe(false);
  });

  it('keeps a suspended employer visible to an admin passing includeInactive=true', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    await patch(EMPLOYER_COMPANY_ID, { active: false }, token);

    const listed = await (await listAsAdmin(token, true)).json();
    const found = listed.data.find((company: { id: string }) => company.id === EMPLOYER_COMPANY_ID);

    expect(found?.active).toBe(false);
  });

  it('reactivates a suspended employer, restoring it to the default listing', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    await patch(EMPLOYER_COMPANY_ID, { active: false }, token);

    const response = await patch(EMPLOYER_COMPANY_ID, { active: true }, token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.active).toBe(true);

    const listed = await (await listAsAdmin(token)).json();

    expect(listed.data.some((company: { id: string }) => company.id === EMPLOYER_COMPANY_ID)).toBe(true);
  });
});
