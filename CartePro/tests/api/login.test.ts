import { POST } from '@/app/api/v1/login/route';
import { mockTables, resetMockDb } from '../mocks/mock-db';
import { EMPLOYER_COMPANY_ID, PARTNER_COMPANY_ID, SEED_PASSWORD } from '../mocks/fixtures';

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

  // A salarié is created with a password their employer chose, so valid
  // credentials exist from the start: only the agent's verification opens the
  // account.
  it('returns 403 for valid credentials on an unverified account', async () =>
  {
    const response = await postLogin({ email: 'pending@example.com', password: SEED_PASSWORD });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Compte non validé');
    expect(json.token).toBeUndefined();
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

  // A suspended company/partner (`Company.active = false`) must lock out the
  // account registered with it, without touching accountStatus so reactivating
  // the company needs no re-verification.
  it('returns 403 for a COMPANY account whose company is suspended', async () =>
  {
    mockTables['Company']!.find((row) => row['id'] === EMPLOYER_COMPANY_ID)!['active'] = false;

    const response = await postLogin({ email: 'company@example.com', password: SEED_PASSWORD });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Compte désactivé');
    expect(json.token).toBeUndefined();
  });

  it('returns 403 for a PARTNER account whose company is suspended', async () =>
  {
    mockTables['Company']!.find((row) => row['id'] === PARTNER_COMPANY_ID)!['active'] = false;

    const response = await postLogin({ email: 'partner-user@example.com', password: SEED_PASSWORD });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Compte désactivé');
  });

  // Suspension targets the COMPANY/PARTNER account itself, not its employees:
  // an employer being suspended does not lock its salariés out.
  it('still lets an employee log in when its employer is suspended', async () =>
  {
    mockTables['Company']!.find((row) => row['id'] === EMPLOYER_COMPANY_ID)!['active'] = false;

    const response = await postLogin({ email: 'employee@example.com', password: SEED_PASSWORD });

    expect(response.status).toBe(200);
  });
});
