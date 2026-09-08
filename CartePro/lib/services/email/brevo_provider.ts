import { BrevoClient, BrevoError } from '@getbrevo/brevo';
import { AppError } from '@/lib/services/error_service';
import type { EmailMessage, EmailProvider, SendEmailResult } from './types';

// Brevo's transactional endpoint wants the sender split into name and address,
// while the rest of the app carries one RFC 5322 string ("Name <a@b.fr>").
type BrevoSender = { email: string; name?: string };

function escapeHtml(value: string): string
{
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// htmlContent is what Brevo actually requires (textContent alone is refused when
// no templateId is given), so a caller that only supplied text — or nothing at
// all — still gets a body: the text turned into paragraphs, or the subject.
function defaultHtmlContent(subject: string, text: string | undefined): string
{
  const body = text === undefined
    ? `<p>${escapeHtml(subject)}</p>`
    : escapeHtml(text)
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
      .join('');

  return `<html><body>${body}</body></html>`;
}

export function createBrevoProvider(): EmailProvider
{
  // Built on first send, not at module load: the API key only has to be present
  // in an environment that actually sends mail, which keeps importing this
  // module safe during tests and `next build`.
  let client: BrevoClient | undefined;

  function getClient(): BrevoClient
  {
    const apiKey = process.env['BREVO_API_KEY'];

    if (!apiKey)
    {
      throw new AppError('BREVO_API_KEY is not configured', 500);
    }

    // BREVO_URL points the SDK at another host (a proxy, or a recording server
    // in a staging environment); unset it to talk to api.brevo.com.
    const baseUrl = process.env['BREVO_URL'];

    client ??= new BrevoClient({ apiKey, ...(baseUrl === undefined ? {} : { baseUrl }) });

    return client;
  }

  return {
    name: 'brevo',

    async send(message: EmailMessage): Promise<SendEmailResult>
    {
      const { to, subject, html, text } = message;
      const brevo = getClient();

      const response = await brevo.transactionalEmails
        .sendTransacEmail({
          sender: { email: "futoltheo@gmail.com", name: "Theo" },
          to: (Array.isArray(to) ? to : [to]).map((email) => ({ email })),
          subject,
          htmlContent: html ?? defaultHtmlContent(subject, text),
          ...(text === undefined ? {} : { textContent: text }),
        })
        .catch((error: unknown) =>
        {
          // The SDK rejects on both API refusals (BrevoError, which carries the
          // API's own message) and transport failures; either way the message
          // did not go out, so both become the 502 route handlers understand.
          const detail = error instanceof BrevoError || error instanceof Error
            ? error.message
            : String(error);

          throw new AppError(`brevo: ${detail}`, 502);
        });

      // messageId is optional in the SDK's own typing — a response without one
      // means the message was not queued, whatever the transport said.
      if (!response.messageId)
      {
        throw new AppError('brevo: message was not accepted', 502);
      }

      return { id: response.messageId };
    },
  };
}
