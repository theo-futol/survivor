import { jest } from '@jest/globals';
import { AppError } from '@/lib/services/error_service';

type MailgunResult = { id?: string; message?: string; status: number };

const create = jest.fn<(domain: string, data: Record<string, unknown>) => Promise<MailgunResult>>();
const clientFactory = jest.fn((_options: Record<string, unknown>) => ({ messages: { create } }));

// mailgun.js's default export is a class instantiated with FormData, whose
// .client(options) returns the API client.
jest.unstable_mockModule('mailgun.js', () => ({
  default: class { client = clientFactory; },
}));

const { createMailgunProvider } = await import('../../lib/services/email/mailgun_provider');

const MESSAGE = {
  from: 'Ticket Tout <noreply@tickettout.fr>',
  to: 'dest@example.fr',
  subject: 'Info',
  text: 'Bonjour',
};

describe('mailgun provider', () =>
{
  beforeEach(() =>
  {
    create.mockReset();
    clientFactory.mockClear();
    create.mockResolvedValue({ id: '<20260905.1@tickettout.fr>', message: 'Queued', status: 200 });
    process.env['MAILGUN_API_KEY'] = 'key-test';
    process.env['MAILGUN_DOMAIN'] = 'tickettout.fr';
    delete process.env['MAILGUN_URL'];
  });

  it('names itself so failures identify the library', () =>
  {
    expect(createMailgunProvider().name).toBe('mailgun');
  });

  it('sends to the configured domain and maps the message fields', async () =>
  {
    await createMailgunProvider().send(MESSAGE);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0]).toBe('tickettout.fr');
    expect(create.mock.calls[0]![1]).toMatchObject({
      from: MESSAGE.from,
      to: MESSAGE.to,
      subject: MESSAGE.subject,
      text: MESSAGE.text,
    });
    expect('html' in create.mock.calls[0]![1]).toBe(false);
  });

  it('returns the mailgun message id', async () =>
  {
    await expect(createMailgunProvider().send(MESSAGE))
      .resolves.toEqual({ id: '<20260905.1@tickettout.fr>' });
  });

  it('does not construct the client until the first send', async () =>
  {
    const provider = createMailgunProvider();

    expect(clientFactory).not.toHaveBeenCalled();

    await provider.send(MESSAGE);
    await provider.send(MESSAGE);

    expect(clientFactory).toHaveBeenCalledTimes(1);
  });

  it('uses the default api host, and MAILGUN_URL when set', async () =>
  {
    await createMailgunProvider().send(MESSAGE);
    expect(clientFactory.mock.calls[0]![0]).toMatchObject({ url: 'https://api.mailgun.net', username: 'api' });

    clientFactory.mockClear();
    process.env['MAILGUN_URL'] = 'https://api.eu.mailgun.net';

    await createMailgunProvider().send(MESSAGE);
    expect(clientFactory.mock.calls[0]![0]).toMatchObject({ url: 'https://api.eu.mailgun.net' });
  });

  it('fails with a 500 when MAILGUN_DOMAIN is missing', async () =>
  {
    delete process.env['MAILGUN_DOMAIN'];

    await expect(createMailgunProvider().send(MESSAGE)).rejects.toMatchObject({ statusCode: 500 });
    expect(create).not.toHaveBeenCalled();
  });

  it('translates a rejected mailgun call into a 502 AppError', async () =>
  {
    create.mockRejectedValue(new Error('Forbidden'));

    const failure = createMailgunProvider().send(MESSAGE);

    await expect(failure).rejects.toBeInstanceOf(AppError);
    await expect(failure).rejects.toMatchObject({ statusCode: 502, message: 'mailgun: Forbidden' });
  });

  it('treats a response without an id as a failure', async () =>
  {
    create.mockResolvedValue({ message: 'Not queued', status: 400 });

    await expect(createMailgunProvider().send(MESSAGE))
      .rejects.toMatchObject({ statusCode: 502, message: 'mailgun: Not queued' });
  });
});
