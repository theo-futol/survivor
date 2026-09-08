import { POST } from '@/app/api/v1/qrcode/route';
import { db } from '@/lib/prisma/db';
import { signToken } from '@/lib/services/auth_service';
import { resetMockDb } from '../mocks/mock-db';

const QRCODE_URL = 'http://localhost/api/v1/qrcode';

function postQrcode(body: unknown, token?: string)
{
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token)
  {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return POST(new Request(QRCODE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }));
}

describe('POST /api/v1/qrcode', () =>
{
  beforeEach(() =>
  {
    resetMockDb();
  });

  it('returns 401 when no token is provided', async () =>
  {
    const response = await postQrcode({ companyId: 'company-test-1', userId: 'user-test-2' });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBeDefined();
  });

  it('returns 403 for a role other than EMPLOYEE', async () =>
  {
    const { token } = await signToken({ sub: 'user-test-1', role: 'COMPANY' });
    const response = await postQrcode({ companyId: 'company-test-1', userId: 'user-test-1' }, token);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBeDefined();
  });

  it('returns 403 when userId does not match the authenticated user', async () =>
  {
    const { token } = await signToken({ sub: 'user-test-2', role: 'EMPLOYEE' });
    const response = await postQrcode({ companyId: 'company-test-1', userId: 'user-test-1' }, token);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBeDefined();
  });

  it('returns 400 for a malformed body', async () =>
  {
    const { token } = await signToken({ sub: 'user-test-2', role: 'EMPLOYEE' });
    const response = await postQrcode({ companyId: 'company-test-1' }, token);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBeDefined();
  });

  it('returns 404 for an unknown company', async () =>
  {
    const { token } = await signToken({ sub: 'user-test-2', role: 'EMPLOYEE' });
    const response = await postQrcode({ companyId: 'does-not-exist', userId: 'user-test-2' }, token);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBeDefined();
  });

  it('returns 201 with a plaintext qrcode and stores only its hash', async () =>
  {
    const { token } = await signToken({ sub: 'user-test-2', role: 'EMPLOYEE' });
    const response = await postQrcode({ companyId: 'company-test-1', userId: 'user-test-2' }, token);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(typeof json.qrcode).toBe('string');
    expect(typeof json.expiresAt).toBe('string');

    const stored = await db.orm.public.QrCode
      .where({ userId: 'user-test-2', companyId: 'company-test-1' })
      .first();

    expect(stored).not.toBeNull();
    expect(stored?.content).not.toBe(json.qrcode);
    expect(stored?.content).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns 409 when a valid qrcode already exists for the employee and company', async () =>
  {
    const { token } = await signToken({ sub: 'user-test-2', role: 'EMPLOYEE' });

    const first = await postQrcode({ companyId: 'company-test-1', userId: 'user-test-2' }, token);
    expect(first.status).toBe(201);

    const second = await postQrcode({ companyId: 'company-test-1', userId: 'user-test-2' }, token);
    const json = await second.json();

    expect(second.status).toBe(409);
    expect(json.error).toBeDefined();
  });
});
