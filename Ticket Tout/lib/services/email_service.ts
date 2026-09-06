import { AppError } from '@/lib/services/error_service';
import { createBrevoProvider } from '@/lib/services/email/brevo_provider';
import type { EmailProvider, SendEmailParams, SendEmailResult } from '@/lib/services/email/types';

export type { EmailProvider, SendEmailParams, SendEmailResult };

const FROM_EMAIL = 'Ticket Tout <noreply@tickettout.fr>';

// The library in use. Swap it by writing another EmailProvider (see
// lib/services/email/types.ts) and either changing this line or calling
// setEmailProvider() — no caller of sendEmail() has to change.
const defaultProvider = createBrevoProvider;

let provider: EmailProvider | undefined;

function getProvider(): EmailProvider
{
  provider ??= defaultProvider();

  return provider;
}

// Point the service at another provider — a second library being trialled, or a
// fake that records messages in a test.
export function setEmailProvider(next: EmailProvider): void
{
  provider = next;
}

export function resetEmailProvider(): void
{
  provider = undefined;
}

export function getEmailProviderName(): string
{
  return getProvider().name;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult>
{
  const { to, subject, html, text } = params;

  if (html === undefined && text === undefined)
  {
    throw new AppError('An email needs an html or text body', 400);
  }

  return getProvider().send({
    from: FROM_EMAIL,
    to,
    subject,
    ...(html === undefined ? {} : { html }),
    ...(text === undefined ? {} : { text }),
  });
}
