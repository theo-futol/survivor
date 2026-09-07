import { GET, POST } from '@/app/api/v1/salaries/[salarieId]/transactions/route';
import { GET as listSalaries } from '@/app/api/v1/salaries/route';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb } from '../mocks/mock-db';
import {
  ADMIN_ID,
  COMPANY_USER_ID,
  EMPLOYEE_ID,
  OTHER_COMPANY_USER_ID,
  PARTNER_USER_ID,
  PENDING_EMPLOYEE_ID,
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

function get(salarieId: string, token?: string)
{
  const request = new Request(`http://localhost/api/v1/salaries/${salarieId}/transactions`, {
    headers: headersFor(token),
  });

  return GET(request, { params: Promise.resolve({ salarieId }) });
}

function post(salarieId: string, body: unknown, token?: string)
{
  const request = new Request(`http://localhost/api/v1/salaries/${salarieId}/transactions`, {
    method: 'POST',
    headers: headersFor(token),
    body: JSON.stringify(body),
  });

  return POST(request, { params: Promise.resolve({ salarieId }) });
}

// Reads the balance back through the public API rather than the mock's internals.
async function balanceOf(salarieId: string): Promise<number>
{
  const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
  const response = await listSalaries(new Request('http://localhost/api/v1/salaries', {
    headers: headersFor(token),
  }));
  const json = await response.json();

  return json.data.find((salarie: { id: string }) => salarie.id === salarieId).balance;
}

describe('GET /api/v1/salaries/{salarieId}/transactions', () =>
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

  it('returns 404 for an unknown salarié', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await get(UNKNOWN_ID, token)).status).toBe(404);
  });

  it('returns 403 when a company reads an employee of another company', async () =>
  {
    const { token } = await signToken({ sub: OTHER_COMPANY_USER_ID, role: 'COMPANY' });

    expect((await get(EMPLOYEE_ID, token)).status).toBe(403);
  });

  // Another salarié, not an admin: GET scopes its lookup to role EMPLOYEE, so a
  // non-employee target is a 404 before ownership is ever considered.
  it('returns 403 when an employee reads someone else', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });

    expect((await get(PENDING_EMPLOYEE_ID, token)).status).toBe(403);
  });

  it('lists the transactions newest first', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });
    const response = await get(EMPLOYEE_ID, token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.transactions.map((t: { id: string }) => t.id)).toEqual(['tx-2', 'tx-1']);
  });

  it('lets an employee read their own transactions', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });

    expect((await get(EMPLOYEE_ID, token)).status).toBe(200);
  });
});

describe('POST /api/v1/salaries/{salarieId}/transactions', () =>
{
  beforeEach(() => resetMockDb());

  const payment = { amount: 400, status: 'VALIDER', type: 'PAYMENT' };

  it('returns 401 without a token', async () =>
  {
    expect((await post(EMPLOYEE_ID, payment)).status).toBe(401);
  });

  it('returns 403 for an EMPLOYEE caller', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });

    expect((await post(EMPLOYEE_ID, payment, token)).status).toBe(403);
  });

  it('returns 400 for a non-uuid identifier', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post('not-a-uuid', payment, token)).status).toBe(400);
  });

  it('returns 400 for a negative amount', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(EMPLOYEE_ID, { ...payment, amount: -5 }, token)).status).toBe(400);
  });

  it('returns 400 for an unknown status', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(EMPLOYEE_ID, { ...payment, status: 'PENDING' }, token)).status).toBe(400);
  });

  it('returns 400 for an unknown type', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(EMPLOYEE_ID, { ...payment, type: 'GIFT' }, token)).status).toBe(400);
  });

  it('returns 404 for an unknown salarié', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(UNKNOWN_ID, payment, token)).status).toBe(404);
  });

  // An overdraft is not rejected, it is recorded: the movement is kept in the
  // ledger with status REFUSER and the balance is left alone.
  it('records a payment larger than the balance as REFUSER', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await post(EMPLOYEE_ID, { ...payment, amount: 5000 }, token);

    expect(response.status).toBe(201);
    expect(await balanceOf(EMPLOYEE_ID)).toBe(1000);

    const json = await (await get(EMPLOYEE_ID, token)).json();
    const recorded = json.transactions.find((t: { amount: number }) => t.amount === 5000);

    expect(recorded.status).toBe('REFUSER');
    expect(recorded.newBalance).toBe(1000);
  });

  it('debits the balance on a PAYMENT', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });
    const response = await post(EMPLOYEE_ID, payment, token);

    expect(response.status).toBe(201);
    expect(await balanceOf(EMPLOYEE_ID)).toBe(600);
  });

  it('credits the balance on a TOPUP', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await post(EMPLOYEE_ID, { amount: 250, status: 'VALIDER', type: 'TOPUP' }, token);

    expect(response.status).toBe(201);
    expect(await balanceOf(EMPLOYEE_ID)).toBe(1250);
  });

  // `status` is still accepted in the body but the server decides it from the
  // balance, so a client cannot mark an affordable payment as refused.
  it('ignores a client-supplied status and derives it from the balance', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await post(EMPLOYEE_ID, { ...payment, status: 'REFUSER' }, token);

    expect(response.status).toBe(201);
    expect(await balanceOf(EMPLOYEE_ID)).toBe(600);

    const json = await (await get(EMPLOYEE_ID, token)).json();
    const recorded = json.transactions.find((t: { amount: number }) => t.amount === payment.amount);

    expect(recorded.status).toBe('VALIDER');
  });

  it('lets a partner initiate a payment', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await post(EMPLOYEE_ID, payment, token)).status).toBe(201);
  });
});
