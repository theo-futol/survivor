import { POST } from '@/app/api/v1/employeurs/[employeurId]/abondements/route';
import { GET } from '@/app/api/v1/salaries/route';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb } from '../mocks/mock-db';
import { ADMIN_ID, COMPANY_USER_ID, EMPLOYEE_ID, EMPLOYER_COMPANY_ID, OTHER_COMPANY_ID, PARTNER_COMPANY_ID, UNKNOWN_ID } from '../mocks/fixtures';

function headersFor(token?: string)
{
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token)
  {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

function post(employeurId: string, body: unknown, token?: string)
{
  const request = new Request(`http://localhost/api/v1/employeurs/${employeurId}/abondements`, {
    method: 'POST',
    headers: headersFor(token),
    body: JSON.stringify(body),
  });

  return POST(request, { params: Promise.resolve({ employeurId }) });
}

const validBody = { montant: 5000, date: '2026-09-01', type: 'fixe', comment: 'Abondement Q3' };

describe('POST /api/v1/employeurs/{employeurId}/abondements', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 401 without a token', async () =>
  {
    expect((await post(EMPLOYER_COMPANY_ID, validBody)).status).toBe(401);
  });

  it('returns 403 for an EMPLOYEE caller', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });

    expect((await post(EMPLOYER_COMPANY_ID, validBody, token)).status).toBe(403);
  });

  it('returns 403 when a COMPANY caller abonds another company', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });

    expect((await post(OTHER_COMPANY_ID, validBody, token)).status).toBe(403);
  });

  it('returns 400 for a negative montant', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(EMPLOYER_COMPANY_ID, { ...validBody, montant: -1 }, token)).status).toBe(400);
  });

  it('returns 400 for an unknown abondement type', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(EMPLOYER_COMPANY_ID, { ...validBody, type: 'mensuel' }, token)).status).toBe(400);
  });

  it('returns 404 for an unknown employer', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(UNKNOWN_ID, validBody, token)).status).toBe(404);
  });

  it('returns 404 when the id belongs to a partner', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(PARTNER_COMPANY_ID, validBody, token)).status).toBe(404);
  });

  it('returns 404 when the employer has no active employee', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(OTHER_COMPANY_ID, validBody, token)).status).toBe(404);
  });

  it('credits every active employee and records one TOPUP transaction each', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });
    const response = await post(EMPLOYER_COMPANY_ID, validBody, token);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toEqual({ montant: 5000, salariesCredites: 1, montantTotal: 5000 });

    const listed = await GET(new Request('http://localhost/api/v1/salaries', { headers: headersFor(token) }));
    const salaries = await listed.json();

    expect(salaries.data[0].balance).toBe(6000);
    expect(salaries.data[0].transactionCount).toBe(3);
    expect(salaries.data[0].transactionTotal).toBe(5500);
  });
});
