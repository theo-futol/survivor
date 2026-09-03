import { z } from 'zod';
import { authorize } from '@/lib/services/auth_service';
import { generateQrCode } from '@/lib/services/qrcode_service';

const qrcodeSchema = z.object({
  companyId: z.string().min(1).regex(/^[^<>'"&]*$/, { message: "Les caractères spéciaux (<, >, ', \", &) sont interdits." }),
  userId: z.string().min(1).regex(/^[^<>'"&]*$/, { message: "Les caractères spéciaux (<, >, ', \", &) sont interdits." }),
});

export async function POST(request: Request)
{
  const auth = await authorize(request, 'POST /api/v1/qrcode');

  if (!auth.ok)
  {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const parsed = qrcodeSchema.safeParse(body);

  if (!parsed.success)
  {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { companyId, userId } = parsed.data;

  if (userId !== auth.sub)
  {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try
  {
    const result = await generateQrCode({ userId, companyId });

    if ('error' in result)
    {
      if (result.error === 'company_not_found')
      {
        return Response.json({ error: 'Company not found' }, { status: 404 });
      }

      return Response.json({ error: 'A valid QR code already exists for this company' }, { status: 409 });
    }

    return Response.json({ qrcode: result.code, expiresAt: result.expiresAt }, { status: 201 });
  }
  catch (error)
  {
    console.error('QR code generation error', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
