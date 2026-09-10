import { z } from 'zod';
import { authorize } from '@/lib/services/auth_service';
import { generateQrCode } from '@/lib/services/qrcode_service';

const qrcodeSchema = z.object({
  companyId: z.string().min(1).regex(/^[^<>'"&]*$/, { message: "Les caractères spéciaux (<, >, ', \", &) sont interdits." }),
  userId: z.string().min(1).regex(/^[^<>'"&]*$/, { message: "Les caractères spéciaux (<, >, ', \", &) sont interdits." }),
});

/**
 * @openapi
 * /api/v1/qrcode:
 *   post:
 *     tags:
 *       - QR Code
 *     summary: Génération d'un QR code de paiement éphémère
 *     description: "Génère un code de paiement sécurisé pour le salarié authentifié, valable 5 minutes, auprès du partenaire marchand spécifié. Le code brut en clair n'est retourné qu'à la création pour rendu en frontend ; seule son empreinte SHA-256 est persistée en base. Si un QR code non expiré existe déjà pour cette paire salarié / partenaire, il est retourné tel quel (code 200) afin d'éviter les doublons."
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyId
 *               - userId
 *             properties:
 *               companyId:
 *                 type: string
 *                 format: uuid
 *                 description: "Identifiant de l'entreprise partenaire réceptrice"
 *                 example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: "Identifiant du salarié payeur (doit concorder avec le token JWT)"
 *                 example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
 *     responses:
 *       '200':
 *         description: QR code valide existant réutilisé et retourné.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - qrcode
 *                 - expiresAt
 *               properties:
 *                 qrcode:
 *                   type: string
 *                   description: "Code de paiement aléatoire en clair"
 *                   example: "7e9b4d32f1a64c89b21a8d"
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: "Date et heure ISO-8601 d'expiration"
 *                   example: "2026-09-02T12:35:00.000Z"
 *       '201':
 *         description: Nouveau QR code généré avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - qrcode
 *                 - expiresAt
 *               properties:
 *                 qrcode:
 *                   type: string
 *                   description: "Code de paiement aléatoire en clair"
 *                   example: "7e9b4d32f1a64c89b21a8d"
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: "Date et heure ISO-8601 d'expiration"
 *                   example: "2026-09-02T12:35:00.000Z"
 *       '400':
 *         description: Corps de requête invalide ou identifiants malformés.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Jeton manquant ou invalide.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: "Rôle insuffisant ou tentative de génération pour un autre salarié que soi-même."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Entreprise partenaire introuvable ou inactive.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Erreur serveur interne.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    return Response.json(
      { qrcode: result.code, expiresAt: result.expiresAt },
      { status: result.reused ? 200 : 201 },
    );
  }
  catch (error)
  {
    console.error('QR code generation error', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
