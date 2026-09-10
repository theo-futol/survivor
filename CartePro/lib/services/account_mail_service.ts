import { sendEmail } from '@/lib/services/email_service';

// Every message this application sends must carry it: the platform is a
// demonstrator, not a service anyone should rely on as if it were live.
export const DEMO_DISCLAIMER = 'Démonstrateur technique, ne constitue pas un service public en exploitation.';

// Read at call time, not at module load, so importing this module stays free of
// environment assumptions during tests and `next build`.
export function buildLoginLink(): string
{
  const baseUrl = process.env['APP_BASE_URL'] ?? 'http://localhost:3000';

  return `${baseUrl.replace(/\/+$/, '')}/login`;
}

export type CompanyRecipient = { name: string; email: string };

// Sent the moment an administrator flips `verified` to true.
export async function sendCompanyVerifiedEmail(company: CompanyRecipient): Promise<void>
{
  await sendEmail({
    to: company.email,
    subject: 'Votre entreprise est validée sur Carte Pro',
    text: [
      `Bonjour ${company.name},`,
      '',
      "Votre entreprise vient d'être validée par l'administration.",
      'Vous pouvez désormais vous connecter à Carte Pro avec cette adresse email et',
      'le mot de passe choisi lors de votre inscription :',
      buildLoginLink(),
      '',
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
      '',
      DEMO_DISCLAIMER,
    ].join('\n'),
  });
}

// Acknowledgement sent right after a professional signup, while the company is
// still unverified and waiting for an administrator to review its Kbis.
export async function sendCompanyRegistrationEmail(company: CompanyRecipient): Promise<void>
{
  await sendEmail({
    to: company.email,
    subject: "Votre demande d'inscription Carte Pro est enregistrée",
    text: [
      `Bonjour ${company.name},`,
      '',
      'Votre demande d\'inscription à Carte Pro a bien été enregistrée.',
      "Elle est en attente de validation par l'administration : votre compte ne permet pas",
      'encore de se connecter.',
      'Vous recevrez un email dès que votre entreprise aura été validée.',
      '',
      DEMO_DISCLAIMER,
    ].join('\n'),
  });
}
