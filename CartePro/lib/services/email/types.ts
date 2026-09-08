// The seam between the app and whichever email library is in use. Swapping
// providers (or trying a new library out) means writing one more file that
// implements EmailProvider — nothing outside this folder changes.

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
};

// What a provider actually receives: the caller's params plus the sender, which
// is owned by email_service.ts and never chosen per-call.
export type EmailMessage = SendEmailParams & { from: string };

export type SendEmailResult = { id: string };

export interface EmailProvider {
  // Used in error messages and logs, so a failure names the library that failed.
  readonly name: string;
  send(message: EmailMessage): Promise<SendEmailResult>;
}
