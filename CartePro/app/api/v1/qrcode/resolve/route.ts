import { z } from 'zod';
import { db } from '@/lib/prisma/db';
import { authorize } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { assertOwnsCompany, resolveActor } from '@/lib/services/ownership_service';

const resolveSchema = z.object({
  content: z.string().regex(/^[a-fA-F0-9]{64}$/, 'Invalid content format not matching SHA-256 hash'),
});

/**
 * @openapi
 * /api/v1/qrcode/resolve:
 *   post:
 *     tags:
 *       - QR Code
 *     summary: Résolution d'un QR code scanné par un partenaire
 *     description: "Résout le hash SHA-256 d'un code scanné pour identifier le salarié bénéficiaire et vérifier la validité du code avant d'initier la transaction de paiement. Le hash voyage dans le corps de la requête afin de ne jamais figurer dans les logs d'URL. Un partenaire marchand ne peut résoudre que les codes émis pour son propre établissement ; un `ADMIN` peut résoudre n'importe quel code. La résolution ne consomme pas le QR code."
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 pattern: '^[a-fA-F0-9]{64}$'
 *                 description: "Empreinte SHA-256 (64 caractères hexadécimaux) du code QR scanné"
 *                 example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *     responses:
 *       '200':
 *         description: QR code valide et profil du salarié retourné.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - salarieId
 *                 - name
 *                 - surname
 *                 - companyId
 *                 - expiresAt
 *               properties:
 *                 salarieId:
 *                   type: string
 *                   format: uuid
 *                   example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
 *                 name:
 *                   type: string
 *                   example: "Jean"
 *                 surname:
 *                   type: string
 *                   example: "Dupont"
 *                 companyId:
 *                   type: string
 *                   format: uuid
 *                   example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-09-02T12:35:00.000Z"
 *       '400':
 *         description: "Corps de requête invalide ou QR code expiré."
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
 *         description: "Rôle insuffisant ou QR code émis pour un autre point de vente."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: "QR code inconnu ou salarié associé introuvable/inactif."
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
  try
  {
    const auth = await authorize(request, 'POST /api/v1/qrcode/resolve');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() =>
    {
      throw new AppError('Invalid JSON in request body', 400);
    });

    const { content } = await resolveSchema.parseAsync(body).catch(() =>
    {
      throw new AppError('Invalid request body', 400);
    });

    const qrcode = await db.orm.public.QrCode.where({ content }).first();

    if (!qrcode)
    {
      throw new AppError('QrCode not found', 404);
    }

    assertOwnsCompany(await resolveActor(auth), qrcode.companyId);

    if (new Date(qrcode.expiredAt.toString()).getTime() <= Date.now())
    {
      throw new AppError('QrCode expired', 400);
    }

    const salarie = await db.orm.public.Users
      .where({ id: qrcode.userId })
      .select('id', 'name', 'surname', 'expiredAt')
      .first();

    if (!salarie || salarie.expiredAt !== null)
    {
      throw new AppError('Salarie not found', 404);
    }

    return Response.json({
      salarieId: salarie.id,
      name: salarie.name,
      surname: salarie.surname,
      companyId: qrcode.companyId,
      expiresAt: qrcode.expiredAt.toString(),
    });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}
