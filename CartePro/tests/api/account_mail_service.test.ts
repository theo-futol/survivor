import { resetMockEmail, sentEmails } from '../mocks/mock-email';

// jest.config.ts maps '@/lib/services/email_service' to tests/mocks/mock-email.ts,
// and this module imports it through that alias — so the bodies it builds land in
// `sentEmails` without any module mocking here.
const { DEMO_DISCLAIMER, buildLoginLink, sendCompanyRegistrationEmail, sendCompanyVerifiedEmail } =
  await import('../../lib/services/account_mail_service');

describe('account mail service', () =>
{
  const previousBaseUrl = process.env['APP_BASE_URL'];

  beforeEach(() => resetMockEmail());

  afterEach(() =>
  {
    if (previousBaseUrl === undefined)
    {
      delete process.env['APP_BASE_URL'];
    }
    else
    {
      process.env['APP_BASE_URL'] = previousBaseUrl;
    }
  });

  it('falls back to localhost when APP_BASE_URL is unset', () =>
  {
    delete process.env['APP_BASE_URL'];

    expect(buildLoginLink()).toBe('http://localhost:3000/login');
  });

  it('honours APP_BASE_URL and trims its trailing slashes', () =>
  {
    process.env['APP_BASE_URL'] = 'https://carte.pro//';

    expect(buildLoginLink()).toBe('https://carte.pro/login');
  });

  it('mails a validated company its login link', async () =>
  {
    process.env['APP_BASE_URL'] = 'https://carte.pro';

    await sendCompanyVerifiedEmail({ name: 'Entreprise SA', email: 'employer@example.com' });

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]!.to).toBe('employer@example.com');
    expect(sentEmails[0]!.text).toContain('Entreprise SA');
    expect(sentEmails[0]!.text).toContain('https://carte.pro/login');
  });

  it('acknowledges a registration without promising a login yet', async () =>
  {
    await sendCompanyRegistrationEmail({ name: 'Entreprise SA', email: 'employer@example.com' });

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]!.subject).toContain('inscription');
    expect(sentEmails[0]!.text).not.toContain('/login');
  });

  // The disclaimer is mandatory on every message this demonstrator sends.
  it('ends every message with the demonstrator disclaimer', async () =>
  {
    await sendCompanyVerifiedEmail({ name: 'Entreprise SA', email: 'employer@example.com' });
    await sendCompanyRegistrationEmail({ name: 'Entreprise SA', email: 'employer@example.com' });

    expect(DEMO_DISCLAIMER).toBe('Démonstrateur technique, ne constitue pas un service public en exploitation.');

    for (const email of sentEmails)
    {
      expect(email.text!.endsWith(DEMO_DISCLAIMER)).toBe(true);
    }
  });
});
