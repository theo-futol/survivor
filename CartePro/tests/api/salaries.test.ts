import { GET, POST } from '@/app/api/v1/salaries/route';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb } from '../mocks/mock-db';
import { resetMockEmail, sentEmails } from '../mocks/mock-email';
import {
  ADMIN_ID,
  COMPANY_USER_ID,
  EMPLOYEE_ID,
  EMPLOYER_COMPANY_ID,
  OTHER_COMPANY_ID,
  UNKNOWN_ID,
} from '../mocks/fixtures';

const URL = 'http://localhost/api/v1/salaries';

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
  email: 'nouveau-salarie@example.com',
  surname: 'Durand',
  name: 'Marie',
  password: 'Secret123!',
  companyId: EMPLOYER_COMPANY_ID,
};

describe('GET /api/v1/salaries', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 401 without a token', async () =>
  {
    expect((await get()).status).toBe(401);
  });

  it('returns 403 for an EMPLOYEE caller', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });

    expect((await get('', token)).status).toBe(403);
  });

  it('enriches each salarié with isBanned and transaction aggregates', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });
    const response = await get('', token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toMatchObject({
      id: EMPLOYEE_ID,
      isBanned: false,
      transactionCount: 2,
      transactionTotal: 500,
    });
    expect(json.data[0].password).toBeUndefined();
  });

  it('ignores an employeurId that is not the caller own company', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });
    const json = await (await get(`?employeurId=${OTHER_COMPANY_ID}`, token)).json();

    expect(json.data.every((s: { companyId: string }) => s.companyId === EMPLOYER_COMPANY_ID)).toBe(true);
  });

  it('lets an admin filter by employeurId', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const json = await (await get(`?employeurId=${UNKNOWN_ID}`, token)).json();

    expect(json.data).toHaveLength(0);
    expect(json.meta.total).toBe(0);
  });
});

describe('POST /api/v1/salaries', () =>
{
  beforeEach(() =>
  {
    resetMockDb();
    resetMockEmail();
  });

  it('returns 403 when a COMPANY caller targets another company', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });

    expect((await post({ ...validBody, companyId: OTHER_COMPANY_ID }, token)).status).toBe(403);
  });

  it('returns 400 with the validation reason when the password does not meet the complexity rules', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await post({ ...validBody, password: 'weak' }, token);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Le mot de passe doit contenir au moins 8 caractères.');
  });

  it('creates without requiring a contract or document id', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });
    const response = await post(validBody, token);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.documentId).toBeUndefined();
  });

  it('returns 404 for an unknown company', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post({ ...validBody, companyId: UNKNOWN_ID }, token)).status).toBe(404);
  });

  it('returns 409 when the email is already taken', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post({ ...validBody, email: 'employee@example.com' }, token)).status).toBe(409);
  });

  it('creates the salarié PENDING, with role EMPLOYEE, balance 0 and no password returned', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });
    const response = await post(validBody, token);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.role).toBe('EMPLOYEE');
    expect(json.balance).toBe(0);
    expect(json.accountStatus).toBe('PENDING');
    expect(json.password).toBeUndefined();
  });

  it('sends no email at creation: the notice goes out at verification', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });

    expect((await post(validBody, token)).status).toBe(201);
    expect(sentEmails).toHaveLength(0);
  });
});
