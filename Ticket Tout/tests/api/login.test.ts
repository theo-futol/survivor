import { POST } from '@/app/api/v1/login/route';
import { resetMockDb } from '../mocks/mock-db';
import { SEED_PASSWORD } from '../mocks/fixtures';

const LOGIN_URL = 'http://localhost/api/v1/login';

function postLogin(body: unknown)
{
  return POST(new Request(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/v1/login', () =>
{
  beforeEach(() =>
  {
    resetMockDb();
  });

  it('returns 400 for a malformed body', async () =>
  {
    const response = await postLogin({ email: 'not-an-email' });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBeDefined();
  });

  it('returns 401 for an unknown email', async () =>
  {
    const response = await postLogin({ email: 'does-not-exist@example.com', password: 'Whatever1!' });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Invalid credentials');
  });

  it('returns 401 for a wrong password', async () =>
  {
    const response = await postLogin({ email: 'test-login@example.com', password: 'WrongPass1!' });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Invalid credentials');
  });

  it('returns 200 with a token and the user role for valid credentials', async () =>
  {
    const response = await postLogin({ email: 'test-login@example.com', password: SEED_PASSWORD });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(typeof json.token).toBe('string');
    expect(json.expiresIn).toBe(1800);
    expect(json.user).toEqual({ id: 'user-test-1', role: 'COMPANY' });
  });
});
