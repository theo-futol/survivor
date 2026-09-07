import { jest } from '@jest/globals';
import { AppError } from '@/lib/services/error_service';

type SendRequest = {
  sender: { email: string; name?: string };
  to: { email: string }[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
};

const sendTransacEmail = jest.fn<(request: SendRequest) => Promise<{ messageId?: string }>>();
const clientConstructor = jest.fn<(options: Record<string, unknown>) => void>();

// The SDK's BrevoClient is replaced by a stub exposing the one resource the
// provider uses; BrevoError stays a real class so `instanceof` still means
// something in the provider's error branch.
class BrevoErrorStub extends Error {}

jest.unstable_mockModule('@getbrevo/brevo', () => ({
  BrevoClient: class
  {
    transactionalEmails = { sendTransacEmail };

    constructor(options: Record<string, unknown>)
    {
      clientConstructor(options);
    }
  },
  BrevoError: BrevoErrorStub,
}));

const { createBrevoProvider } = await import('../../lib/services/email/brevo_provider');

const MESSAGE = {
  from: 'Theo <futoltheo@gmail.com>',
  to: 'dest@example.fr',
  subject: 'Info',
  text: 'Bonjour',
};

function sentRequest(call = 0): SendRequest
{
  return sendTransacEmail.mock.calls[call]![0];
}

describe('brevo provider', () =>
{
  beforeEach(() =>
  {
    sendTransacEmail.mockReset();
    clientConstructor.mockClear();
    sendTransacEmail.mockResolvedValue({ messageId: '<202609061212.1@smtp-relay.mailin.fr>' });
    process.env['BREVO_API_KEY'] = 'xkeysib-test';
    delete process.env['BREVO_URL'];
  });

  it('names itself so failures identify the library', () =>
  {
    expect(createBrevoProvider().name).toBe('brevo');
  });

  it('splits the sender and maps the message fields', async () =>
  {
    await createBrevoProvider().send({ ...MESSAGE, html: '<p>Bonjour</p>' });

    expect(sendTransacEmail).toHaveBeenCalledTimes(1);
    expect(sentRequest()).toEqual({
      sender: { email: 'futoltheo@gmail.com', name: 'Theo' },
      to: [{ email: 'dest@example.fr' }],
      subject: 'Info',
      htmlContent: '<p>Bonjour</p>',
      textContent: 'Bonjour',
    });
  });

  it('accepts a bare address as the sender and several recipients', async () =>
  {
    await createBrevoProvider().send({
      ...MESSAGE,
      to: ['un@example.fr', 'deux@example.fr'],
    });

    expect(sentRequest().sender).toEqual({ email: 'futoltheo@gmail.com', name: 'Theo' });
    expect(sentRequest().to).toEqual([{ email: 'un@example.fr' }, { email: 'deux@example.fr' }]);
  });

  it('builds an html body from the text when none was supplied', async () =>
  {
    await createBrevoProvider().send({ ...MESSAGE, text: 'Bonjour\nÀ bientôt\n\nTicket Tout' });

    expect(sentRequest().htmlContent)
      .toBe('<html><body><p>Bonjour<br />À bientôt</p><p>Ticket Tout</p></body></html>');
    expect(sentRequest().textContent).toBe('Bonjour\nÀ bientôt\n\nTicket Tout');
  });

  it('escapes the text it turns into html', async () =>
  {
    await createBrevoProvider().send({ ...MESSAGE, text: 'Solde < 10 & <script>' });

    expect(sentRequest().htmlContent)
      .toBe('<html><body><p>Solde &lt; 10 &amp; &lt;script&gt;</p></body></html>');
  });

  it('falls back to the subject when neither body was supplied', async () =>
  {
    await createBrevoProvider().send({ from: MESSAGE.from, to: MESSAGE.to, subject: 'Info' });

    expect(sentRequest().htmlContent).toBe('<html><body><p>Info</p></body></html>');
    expect('textContent' in sentRequest()).toBe(false);
  });

  it('returns the brevo message id', async () =>
  {
    await expect(createBrevoProvider().send(MESSAGE))
      .resolves.toEqual({ id: '<202609061212.1@smtp-relay.mailin.fr>' });
  });

  it('does not construct the client until the first send', async () =>
  {
    const provider = createBrevoProvider();

    expect(clientConstructor).not.toHaveBeenCalled();

    await provider.send(MESSAGE);
    await provider.send(MESSAGE);

    expect(clientConstructor).toHaveBeenCalledTimes(1);
    expect(clientConstructor.mock.calls[0]![0]).toEqual({ apiKey: 'xkeysib-test' });
  });

  it('points the sdk at BREVO_URL when set', async () =>
  {
    process.env['BREVO_URL'] = 'https://proxy.tickettout.fr/v3';

    await createBrevoProvider().send(MESSAGE);

    expect(clientConstructor.mock.calls[0]![0])
      .toMatchObject({ baseUrl: 'https://proxy.tickettout.fr/v3' });
  });

  it('fails with a 500 when BREVO_API_KEY is missing', async () =>
  {
    delete process.env['BREVO_API_KEY'];

    await expect(createBrevoProvider().send(MESSAGE)).rejects.toMatchObject({ statusCode: 500 });
    expect(sendTransacEmail).not.toHaveBeenCalled();
  });

  it('translates an api refusal into a 502 AppError', async () =>
  {
    sendTransacEmail.mockRejectedValue(new BrevoErrorStub('Sender not valid'));

    const failure = createBrevoProvider().send(MESSAGE);

    await expect(failure).rejects.toBeInstanceOf(AppError);
    await expect(failure).rejects.toMatchObject({ statusCode: 502, message: 'brevo: Sender not valid' });
  });

  it('translates a transport failure into a 502 AppError', async () =>
  {
    sendTransacEmail.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(createBrevoProvider().send(MESSAGE))
      .rejects.toMatchObject({ statusCode: 502, message: 'brevo: ECONNREFUSED' });
  });

  it('treats a response without a messageId as a failure', async () =>
  {
    sendTransacEmail.mockResolvedValue({});

    await expect(createBrevoProvider().send(MESSAGE))
      .rejects.toMatchObject({ statusCode: 502, message: 'brevo: message was not accepted' });
  });
});
