import { GET, POST } from '@/app/api/v1/salaries/[salarieId]/transactions/route';
import { GET as listSalaries } from '@/app/api/v1/salaries/route';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb } from '../mocks/mock-db';
import {
  ADMIN_ID,
  COMPANY_USER_ID,
  EMPLOYEE_ID,
  OTHER_COMPANY_USER_ID,
  PARTNER_COMPANY_ID,
  PARTNER_USER_ID,
  PENDING_EMPLOYEE_ID,
  QR_CODE_CONTENT,
  QR_CODE_EXPIRED_CONTENT,
  QR_CODE_OTHER_COMPANY_CONTENT,
  QR_CODE_UNKNOWN_CONTENT,
  UNKNOWN_ID,
  OTHER_COMPANY_ID,
  PARTNER_COMPANY_ID,
  VALID_QRCODE_CONTENT,
  EXPIRED_QRCODE_CONTENT,
  UNKNOWN_QRCODE_CONTENT,
  OTHER_COMPANY_QRCODE_CONTENT,
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

  // The QR code the employee showed: its SHA-256 hash plus the partner shop it
  // was issued for. Both have to line up with the scanned code server-side.
  const payment = {
    amount: 400,
    type: 'PAYMENT',
    content: VALID_QRCODE_CONTENT,
    companyId: PARTNER_COMPANY_ID,
  };

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

    expect((await post(EMPLOYEE_ID, { ...payment, amount: -5 }, token))?.status).toBe(400);
  });

  // Balances are integer cents, so a fractional amount would be silently coerced
  // by the int4 column if it ever reached it.
  it('returns 400 for a fractional amount', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(EMPLOYEE_ID, { ...payment, status: 'PENDING' }, token))?.status).toBe(400);
  });

  it('returns 400 for an unknown type', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(EMPLOYEE_ID, { ...payment, type: 'GIFT' }, token)).status).toBe(400);
  });

  it('returns 400 for a malformed QR code', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(EMPLOYEE_ID, { ...payment, content: 'nope' }, token)).status).toBe(400);
  });

  it('returns 400 when the content is not a SHA-256 hash', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(EMPLOYEE_ID, { ...payment, content: 'not-a-hash' }, token)).status).toBe(400);
  });

  it('returns 404 for an unknown salarié', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(UNKNOWN_ID, payment, token)).status).toBe(404);
  });

  it('returns 404 when no QR code matches the submitted one', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await post(EMPLOYEE_ID, { ...payment, content: QR_CODE_UNKNOWN_CONTENT }, token);

    expect(response.status).toBe(404);
    expect(await balanceOf(EMPLOYEE_ID)).toBe(1000);
  });

  it('returns 400 for an expired QR code', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await post(EMPLOYEE_ID, { ...payment, content: QR_CODE_EXPIRED_CONTENT }, token);

    expect(response.status).toBe(400);
    expect(await balanceOf(EMPLOYEE_ID)).toBe(1000);
  });

  // The QR code is bound to the company it was issued for, so another partner
  // cannot cash it in by naming itself in the body.
  it('returns 403 when the QR code belongs to another company', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await post(EMPLOYEE_ID, { ...payment, content: QR_CODE_OTHER_COMPANY_CONTENT }, token);

    expect(response.status).toBe(403);
    expect(await balanceOf(EMPLOYEE_ID)).toBe(1000);
  });

  it('returns 404 for a QR code that does not exist', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(EMPLOYEE_ID, { ...payment, content: UNKNOWN_QRCODE_CONTENT }, token)).status).toBe(404);
  });

  it('returns 400 for an expired QR code', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(EMPLOYEE_ID, { ...payment, content: EXPIRED_QRCODE_CONTENT }, token)).status).toBe(400);
  });

  it('returns 403 when the QR code was issued for another company', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await post(EMPLOYEE_ID, { ...payment, content: OTHER_COMPANY_QRCODE_CONTENT }, token);

    expect(response.status).toBe(403);
  });

  it('returns 403 when the QR code belongs to another salarié', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(PENDING_EMPLOYEE_ID, payment, token)).status).toBe(403);
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

  // A refused payment never happened, so the code stays spendable and the
  // cashier can retry with a smaller amount.
  it('leaves the QR code usable after a REFUSER', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(EMPLOYEE_ID, { ...payment, amount: 5000 }, token)).status).toBe(201);
    expect((await post(EMPLOYEE_ID, payment, token)).status).toBe(201);
    expect(await balanceOf(EMPLOYEE_ID)).toBe(600);
  });

  it('debits the balance on a PAYMENT', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });
    const response = await post(EMPLOYEE_ID, payment, token);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.status).toBe('VALIDER');
    expect(json.newBalance).toBe(600);
    expect(await balanceOf(EMPLOYEE_ID)).toBe(600);
  });

  // The transaction is booked against the company the QR code was issued for,
  // not against whoever happens to be calling.
  it('records the transaction against the QR code company', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await post(EMPLOYEE_ID, payment, token)).status).toBe(201);

    const json = await (await get(EMPLOYEE_ID, token)).json();
    const recorded = json.transactions.find((t: { newBalance?: number }) => t.newBalance === 600);

    expect(recorded.companyId).toBe(PARTNER_COMPANY_ID);
  });

  it('credits the balance on a TOPUP', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await post(EMPLOYEE_ID, { ...payment, amount: 250, type: 'TOPUP' }, token);

    expect(response.status).toBe(201);
    expect(await balanceOf(EMPLOYEE_ID)).toBe(1250);
  });

  // transaction_type_matches_company: a TOPUP row must not carry a company, and
  // the response has to say what was stored rather than what was asked for.
  it('stores a TOPUP without a company', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await post(EMPLOYEE_ID, { ...payment, amount: 250, type: 'TOPUP' }, token);

    expect(response.status).toBe(201);
    expect((await response.json()).companyId).toBeNull();

    const json = await (await get(EMPLOYEE_ID, token)).json();
    const recorded = json.transactions.find((t: { amount: number }) => t.amount === 250);

    expect(recorded.companyId).toBeNull();
  });

  // The status is the server's call, derived from the balance, so a client
  // cannot mark an affordable payment as refused.
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

  // A partner may only cash in for its own shop, even holding a valid code.
  it('returns 403 when a partner bills another partner', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });
    const response = await post(EMPLOYEE_ID, { ...payment, content: OTHER_COMPANY_QRCODE_CONTENT, companyId: OTHER_COMPANY_ID }, token);

    expect(response.status).toBe(403);
  });

  // One scan, one charge: a validated code is consumed so it cannot be replayed
  // during the five minutes it stays otherwise valid.
  it('consumes the QR code once the payment is validated', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await post(EMPLOYEE_ID, payment, token)).status).toBe(201);
    expect((await post(EMPLOYEE_ID, payment, token)).status).toBe(404);
    expect(await balanceOf(EMPLOYEE_ID)).toBe(600);
  });
});
