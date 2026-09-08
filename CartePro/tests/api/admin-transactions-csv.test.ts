import { GET } from '@/app/api/v1/admin/transactions.csv/route';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb } from '../mocks/mock-db';
import { ADMIN_ID, COMPANY_USER_ID, EMPLOYEE_ID, PARTNER_COMPANY_ID } from '../mocks/fixtures';

const URL = 'http://localhost/api/v1/admin/transactions.csv';

function get(token?: string)
{
  const headers: Record<string, string> = {};

  if (token)
  {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return GET(new Request(URL, { headers }));
}

describe('GET /api/v1/admin/transactions.csv', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 401 without a token', async () =>
  {
    expect((await get()).status).toBe(401);
  });

  it('returns 403 for a COMPANY caller', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });

    expect((await get(token)).status).toBe(403);
  });

  it('returns 403 for an EMPLOYEE caller', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });

    expect((await get(token)).status).toBe(403);
  });

  it('serves a downloadable csv attachment to an admin', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await get(token);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="transactions.csv"');
  });

  it('writes the header row and one line per transaction', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const csv = await (await get(token)).text();
    const lines = csv.trim().split('\n');

    expect(lines[0]).toBe('id;date_iso8601;employee_id;partner_id;amount_cents;status');
    expect(lines).toHaveLength(3); // header + the two fixture transactions

    const first = lines[1]!.split(';');

    expect(first[0]).toBe('tx-1');
    expect(first[2]).toBe(EMPLOYEE_ID);
    expect(first[3]).toBe(PARTNER_COMPANY_ID);
    expect(first[4]).toBe('300');
    expect(first[5]).toBe('VALIDER');
  });
});
