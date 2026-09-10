import crypto from 'crypto';
import { db } from '@/lib/prisma/db';

const QRCODE_EXPIRES_IN_SECONDS = 300;

export type GenerateQrCodeResult =
  | { code: string; expiresAt: string; reused: boolean }
  | { error: 'company_not_found' };

export async function generateQrCode(params: { userId: string; companyId: string }): Promise<GenerateQrCodeResult>
{
  const company = await db.orm.public.Company.where({ id: params.companyId }).first();

  if (!company)
  {
    return { error: 'company_not_found' };
  }

  const now = Temporal.Now.instant();

  const existingQrCode = await db.orm.public.QrCode
    .where({ userId: params.userId, companyId: params.companyId })
    .orderBy((q) => q.expiredAt.desc())
    .first();

  if (existingQrCode && Temporal.Instant.compare(existingQrCode.expiredAt, now) > 0)
  {
    return { code: existingQrCode.content, expiresAt: existingQrCode.expiredAt.toString(), reused: true };
  }

  // The salarié presents this value and POST /salaries/:id/transactions matches
  // it against the stored `content` as-is, so the two have to be the same
  // 64-hex string: the digest is what gets handed out, not the seed behind it.
  const seed = crypto.randomBytes(16).toString('hex');
  const hashedContent = crypto.createHash('sha256').update(seed).digest('hex');
  const expiredAt = Temporal.Now.instant().add({ seconds: QRCODE_EXPIRES_IN_SECONDS });

  await db.orm.public.QrCode.create({
    content: hashedContent,
    expiredAt,
    userId: params.userId,
    companyId: params.companyId,
  });

  return { code: hashedContent, expiresAt: expiredAt.toString(), reused: false };
}
