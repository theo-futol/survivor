import crypto from 'crypto';
import { db } from '@/lib/prisma/db';

const QRCODE_EXPIRES_IN_SECONDS = 300;

export type GenerateQrCodeResult =
  | { code: string; expiresAt: string }
  | { error: 'company_not_found' | 'qrcode_exists' };

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
    .first();

  if (existingQrCode && Temporal.Instant.compare(existingQrCode.expiredAt, now) > 0)
  {
    return { error: 'qrcode_exists' };
  }

  const code = crypto.randomBytes(16).toString('hex');
  const hashedContent = crypto.createHash('sha256').update(code).digest('hex');
  const expiredAt = Temporal.Now.instant().add({ seconds: QRCODE_EXPIRES_IN_SECONDS });

  await db.orm.public.QrCode.create({
    content: hashedContent,
    expiredAt,
    userId: params.userId,
    companyId: params.companyId,
  });

  return { code, expiresAt: expiredAt.toString() };
}
