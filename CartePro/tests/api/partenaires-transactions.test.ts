import { GET } from '@/app/api/v1/partenaires/[partenaireId]/transactions/route';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb, mockTables } from '../mocks/mock-db';
import {
  ADMIN_ID,
  EMPLOYEE_ID,
  EMPLOYER_COMPANY_ID,
  OTHER_COMPANY_ID,
  PARTNER_COMPANY_ID,
  PARTNER_USER_ID,
} from '../mocks/fixtures';

function get(partenaireId: string, token?: string, query = '')
{
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token)
  {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const request = new Request(`http://localhost/api/v1/partenaires/${partenaireId}/transactions${query}`, { headers });

  return GET(request, { params: Promise.resolve({ partenaireId }) });
}

describe('GET /api/v1/partenaires/{partenaireId}/transactions', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 401 without a token', async () =>
  {
    expect((await get(PARTNER_COMPANY_ID)).status).toBe(401);
  });

  it('returns 403 for a role that is not allowed at all', async () =>
  {
    const { token } = await signToken({ sub: EMPLOYEE_ID, role: 'EMPLOYEE' });

    expect((await get(PARTNER_COMPANY_ID, token)).status).toBe(403);
  });

  it('returns 400 for a non-uuid identifier', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await get('not-a-uuid', token)).status).toBe(400);
  });

  // The partner dashboard reads this endpoint, so a partner must reach its own
  // till — which is exactly as far as it may go.
  it('lets a partner read its own transactions', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });
    const response = await get(PARTNER_COMPANY_ID, token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.transactions.map((t: { id: string }) => t.id)).toEqual(['tx-2', 'tx-1']);
    expect(json.meta.totalCount).toBe(2);
  });

  it('returns 403 when a partner reads another company', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await get(OTHER_COMPANY_ID, token)).status).toBe(403);
  });

  it('lets an admin read any partner', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await get(PARTNER_COMPANY_ID, token)).status).toBe(200);
  });

  // The buyer's name is what makes the till readable; the row only holds a userId.
  it('includes the salarié who paid', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });
    const json = await (await get(PARTNER_COMPANY_ID, token)).json();

    expect(json.transactions[0].user).toEqual({ id: EMPLOYEE_ID, name: 'Jean', surname: 'Dupont' });
  });

  // A shop that has not sold anything yet is not a missing resource: a 404 here
  // made every caller treat "no sales" as a failure.
  it('returns an empty list rather than 404 when there are no transactions', async () =>
  {
    mockTables['Transaction'] = [];

    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const response = await get(PARTNER_COMPANY_ID, token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.transactions).toEqual([]);
    expect(json.meta.totalCount).toBe(0);
  });

  it('scopes the list to the partner asked for', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const json = await (await get(EMPLOYER_COMPANY_ID, token)).json();

    expect(json.transactions).toEqual([]);
  });

  it('paginates', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });
    const json = await (await get(PARTNER_COMPANY_ID, token, '?limit=1&page=2')).json();

    expect(json.transactions.map((t: { id: string }) => t.id)).toEqual(['tx-1']);
    expect(json.meta).toMatchObject({ page: 2, limit: 1, totalCount: 2, totalPages: 2, hasNextPage: false, hasPrevPage: true });
  });
});
