import { z } from 'zod';
import { authorize } from '@/lib/services/auth_service';
import { generateQrCode } from '@/lib/services/qrcode_service';

const qrcodeSchema = z.object({
  companyId: z.string().min(1).regex(/^[^<>'"&]*$/, { message: "Les caractères spéciaux (<, >, ', \", &) sont interdits." }),
  userId: z.string().min(1).regex(/^[^<>'"&]*$/, { message: "Les caractères spéciaux (<, >, ', \", &) sont interdits." }),
});

/**
 * @openapi
 * /qrcode:
 *   post:
 *     summary: Génération d'un QR code de paiement
 *     description: Génère un QR code de paiement pour le salarié authentifié, valide 5 minutes. Le contenu est haché (SHA-256) avant stockage ; seul le code en clair est retourné au client. Un seul QR code valide est autorisé par salarié et par entreprise partenaire à la fois.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QrCodeRequest'
 *     responses:
 *       '201':
 *         description: QR code généré avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QrCodeResponse'
 *       '400':
 *         description: Corps de requête invalide.
 *       '401':
 *         description: Token manquant ou invalide.
 *       '403':
 *         description: Rôle insuffisant, ou tentative de génération pour un autre salarié.
 *       '404':
 *         description: Entreprise partenaire introuvable.
 *       '409':
 *         description: Un QR code valide existe déjà pour ce salarié et cette entreprise.
 *       '500':
 *         description: Erreur serveur interne.
 */
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
