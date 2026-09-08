import { POST } from '@/app/api/v1/qrcode/resolve/route';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb } from '../mocks/mock-db';
import {
  ADMIN_ID,
  COMPANY_USER_ID,
  EMPLOYEE_ID,
  PARTNER_COMPANY_ID,
  PARTNER_USER_ID,
  VALID_QRCODE_CONTENT,
  EXPIRED_QRCODE_CONTENT,
  UNKNOWN_QRCODE_CONTENT,
  OTHER_COMPANY_QRCODE_CONTENT,
} from '../mocks/fixtures';

const RESOLVE_URL = 'http://localhost/api/v1/qrcode/resolve';

function resolve(body: unknown, token?: string)
{
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token)
  {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return POST(new Request(RESOLVE_URL, { method: 'POST', headers, body: JSON.stringify(body) }));
}

describe('POST /api/v1/qrcode/resolve', () =>
{
  beforeEach(() => resetMockDb());

  it('returns 401 without a token', async () =>
  {
    expect((await resolve({ content: VALID_QRCODE_CONTENT })).status).toBe(401);
  });

  it('returns 403 for a role that cannot cash in', async () =>
  {
    const { token } = await signToken({ sub: COMPANY_USER_ID, role: 'COMPANY' });

    expect((await resolve({ content: VALID_QRCODE_CONTENT }, token)).status).toBe(403);
  });

  it('returns 400 when the content is not a SHA-256 hash', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await resolve({ content: 'nope' }, token)).status).toBe(400);
  });

  it('returns 404 for a QR code that does not exist', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await resolve({ content: UNKNOWN_QRCODE_CONTENT }, token)).status).toBe(404);
  });

  it('returns 400 for an expired QR code', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await resolve({ content: EXPIRED_QRCODE_CONTENT }, token)).status).toBe(400);
  });

  // A partner must not be able to read a code a customer meant for the shop
  // next door, not even to learn whose card it is.
  it('returns 403 for a QR code issued for another company', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await resolve({ content: OTHER_COMPANY_QRCODE_CONTENT }, token)).status).toBe(403);
  });

  it('returns the salarié to bill for its own QR code', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });
    const response = await resolve({ content: VALID_QRCODE_CONTENT }, token);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.salarieId).toBe(EMPLOYEE_ID);
    expect(json.companyId).toBe(PARTNER_COMPANY_ID);
    expect(json.name).toBe('Jean');
    expect(json.surname).toBe('Dupont');
    expect(typeof json.expiresAt).toBe('string');
  });

  it('lets an admin resolve any QR code', async () =>
  {
    const { token } = await signToken({ sub: ADMIN_ID, role: 'ADMIN' });

    expect((await resolve({ content: OTHER_COMPANY_QRCODE_CONTENT }, token)).status).toBe(200);
  });

  // Resolving only reads: the code stays spendable until the payment lands.
  it('does not consume the QR code', async () =>
  {
    const { token } = await signToken({ sub: PARTNER_USER_ID, role: 'PARTNER' });

    expect((await resolve({ content: VALID_QRCODE_CONTENT }, token)).status).toBe(200);
    expect((await resolve({ content: VALID_QRCODE_CONTENT }, token)).status).toBe(200);
  });
});
