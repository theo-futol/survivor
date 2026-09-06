// In-memory stand-in for @/lib/services/email_service, wired in via jest.config.ts's
// moduleNameMapper so route/service code gets it transparently, without reaching
// the Mailgun API during unit tests.
//
// Tests that exercise the real service (and its provider seam) import it by
// relative path instead — see tests/api/email_service.test.ts.
import { AppError } from '@/lib/services/error_service';
import type { EmailProvider, SendEmailParams, SendEmailResult } from '@/lib/services/email/types';

export type { EmailProvider, SendEmailParams, SendEmailResult };

// Every email a test caused, in order — assert against it instead of the network.
const sentEmails: SendEmailParams[] = [];

let provider: EmailProvider | undefined;

async function sendEmail(params: SendEmailParams): Promise<SendEmailResult>
{
  // Mirrors the real service's guard, so a caller that forgets a body fails the
  // same way here as it would in production.
  if (params.html === undefined && params.text === undefined)
  {
    throw new AppError('An email needs an html or text body', 400);
  }

  sentEmails.push({ ...params });

  return { id: `mock-email-${sentEmails.length}` };
}

function setEmailProvider(next: EmailProvider): void
{
  provider = next;
}

function resetEmailProvider(): void
{
  provider = undefined;
}

function getEmailProviderName(): string
{
  return provider?.name ?? 'mock';
}

function resetMockEmail(): void
{
  sentEmails.length = 0;
  provider = undefined;
}

export {
  sendEmail,
  sentEmails,
  setEmailProvider,
  resetEmailProvider,
  getEmailProviderName,
  resetMockEmail,
};
