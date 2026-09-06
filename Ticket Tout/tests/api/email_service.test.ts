import { jest } from '@jest/globals';
import { AppError } from '@/lib/services/error_service';
import type { EmailMessage, EmailProvider } from '@/lib/services/email/types';

// Imported by relative path on purpose: jest.config.ts maps
// '@/lib/services/email_service' to tests/mocks/mock-email.ts, and these tests
// exercise the real implementation.
const { sendEmail, setEmailProvider, resetEmailProvider, getEmailProviderName } =
  await import('../../lib/services/email_service');

const FROM = 'Ticket Tout <noreply@tickettout.fr>';

// The provider seam means these tests need no module mocking at all — a fake
// implementation of the interface is enough.
function recordingProvider(): { provider: EmailProvider; sent: EmailMessage[] }
{
  const sent: EmailMessage[] = [];

  return {
    sent,
    provider: {
      name: 'recording',
      send: async (message) =>
      {
        sent.push(message);

        return { id: `recorded-${sent.length}` };
      },
    },
  };
}

describe('sendEmail', () =>
{
  afterEach(() => resetEmailProvider());

  it('always sends from the constant address', async () =>
  {
    const { provider, sent } = recordingProvider();
    setEmailProvider(provider);

    await sendEmail({ to: 'dest@example.fr', subject: 'Bonjour', text: 'Salut' });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ from: FROM });
  });

  it('forwards to and subject verbatim', async () =>
  {
    const { provider, sent } = recordingProvider();
    setEmailProvider(provider);

    await sendEmail({ to: 'dest@example.fr', subject: 'Votre solde', html: '<p>Bonjour</p>' });

    expect(sent[0]).toMatchObject({ to: 'dest@example.fr', subject: 'Votre solde' });
  });

  it('accepts a list of recipients', async () =>
  {
    const { provider, sent } = recordingProvider();
    setEmailProvider(provider);

    await sendEmail({ to: ['a@example.fr', 'b@example.fr'], subject: 'Info', text: 'Salut' });

    expect(sent[0]).toMatchObject({ to: ['a@example.fr', 'b@example.fr'] });
  });

  it('passes html only, without a text key', async () =>
  {
    const { provider, sent } = recordingProvider();
    setEmailProvider(provider);

    await sendEmail({ to: 'dest@example.fr', subject: 'Info', html: '<p>Bonjour</p>' });

    expect(sent[0]).toMatchObject({ html: '<p>Bonjour</p>' });
    expect('text' in sent[0]!).toBe(false);
  });

  it('passes text only, without an html key', async () =>
  {
    const { provider, sent } = recordingProvider();
    setEmailProvider(provider);

    await sendEmail({ to: 'dest@example.fr', subject: 'Info', text: 'Bonjour' });

    expect(sent[0]).toMatchObject({ text: 'Bonjour' });
    expect('html' in sent[0]!).toBe(false);
  });

  it('rejects a call with neither html nor text, without reaching the provider', async () =>
  {
    const { provider, sent } = recordingProvider();
    setEmailProvider(provider);

    await expect(sendEmail({ to: 'dest@example.fr', subject: 'Vide' }))
      .rejects.toMatchObject({ statusCode: 400 });

    expect(sent).toHaveLength(0);
  });

  it('resolves to the id the provider returned', async () =>
  {
    setEmailProvider({ name: 'stub', send: async () => ({ id: 'mg-abc123' }) });

    await expect(sendEmail({ to: 'dest@example.fr', subject: 'Info', text: 'Bonjour' }))
      .resolves.toEqual({ id: 'mg-abc123' });
  });

  it('lets a provider failure through untouched', async () =>
  {
    setEmailProvider({
      name: 'failing',
      send: async () => { throw new AppError('brevo: sender not found', 502); },
    });

    const failure = sendEmail({ to: 'dest@example.fr', subject: 'Info', text: 'Bonjour' });

    await expect(failure).rejects.toBeInstanceOf(AppError);
    await expect(failure).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe('provider selection', () =>
{
  afterEach(() => resetEmailProvider());

  it('defaults to brevo', () =>
  {
    expect(getEmailProviderName()).toBe('brevo');
  });

  it('swaps in another library without touching callers', async () =>
  {
    const { provider, sent } = recordingProvider();
    setEmailProvider(provider);

    expect(getEmailProviderName()).toBe('recording');

    await sendEmail({ to: 'dest@example.fr', subject: 'Info', text: 'Bonjour' });

    expect(sent).toHaveLength(1);
  });

  it('builds the default provider once and reuses it', async () =>
  {
    const send = jest.fn<EmailProvider['send']>(async () => ({ id: 'x' }));
    setEmailProvider({ name: 'counting', send });

    await sendEmail({ to: 'dest@example.fr', subject: 'Un', text: 'Bonjour' });
    await sendEmail({ to: 'dest@example.fr', subject: 'Deux', text: 'Bonjour' });

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('restores the default provider on reset', () =>
  {
    setEmailProvider({ name: 'temporary', send: async () => ({ id: 'x' }) });
    expect(getEmailProviderName()).toBe('temporary');

    resetEmailProvider();

    expect(getEmailProviderName()).toBe('brevo');
  });
});
