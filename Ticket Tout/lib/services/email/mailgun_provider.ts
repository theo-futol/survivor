import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { AppError } from '@/lib/services/error_service';
import type { EmailMessage, EmailProvider, SendEmailResult } from './types';

const DEFAULT_API_URL = 'https://api.mailgun.net';

// mailgun.js only exports its root and './definitions', so the client type is
// derived from the class rather than imported from a subpath.
type MailgunClient = ReturnType<InstanceType<typeof Mailgun>['client']>;

export function createMailgunProvider(): EmailProvider
{
  // Built on first send, not at module load: the API key and domain only have to
  // be present in an environment that actually sends mail, which keeps importing
  // this module safe during tests and `next build`.
  let client: MailgunClient | undefined;

  function getClient(): MailgunClient
  {
    client ??= new Mailgun(FormData).client({
      username: 'api',
      key: process.env['MAILGUN_API_KEY'] ?? '',
      // Mailgun's EU region lives on a different host; set MAILGUN_URL to
      // https://api.eu.mailgun.net for an EU domain.
      url: process.env['MAILGUN_URL'] ?? DEFAULT_API_URL,
    });

    return client;
  }

  return {
    name: 'mailgun',

    async send(message: EmailMessage): Promise<SendEmailResult>
    {
      const domain = process.env['MAILGUN_DOMAIN'];

      if (!domain)
      {
        throw new AppError('MAILGUN_DOMAIN is not configured', 500);
      }

      const { from, to, subject, html, text } = message;

      // Unlike some clients, mailgun.js rejects its promise on an API error
      // rather than returning one, so the throw is translated here into the
      // AppError shape the route handlers already understand.
      // Mailgun types the body as "at least one of html/text/template", which an
      // object with optional keys does not satisfy — hence branching on what was
      // supplied rather than spreading `{ html, text }` straight through.
      const body = html === undefined
        ? { text: text as string }
        : text === undefined
          ? { html }
          : { html, text };

      const result = await getClient().messages
        .create(domain, { from, to, subject, ...body })
        .catch((error: unknown) =>
        {
          const detail = error instanceof Error ? error.message : String(error);

          throw new AppError(`mailgun: ${detail}`, 502);
        });

      // `id` is optional in mailgun.js's own typing — a response without one
      // means the message was not queued, whatever the transport said.
      if (!result.id)
      {
        throw new AppError(`mailgun: ${result.message ?? 'message was not accepted'}`, 502);
      }

      return { id: result.id };
    },
  };
}
