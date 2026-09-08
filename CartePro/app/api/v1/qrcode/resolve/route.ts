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
 *     summary: Résolution d'un QR code de paiement scanné
 *     description: "Traduit le hash SHA-256 d'un QR code scanné en salarié à facturer, pour que le partenaire puisse ensuite appeler `POST /api/v1/salaries/{salarieId}/transactions`. Le hash voyage dans le corps et non dans l'URL : c'est lui qui autorise l'encaissement, il n'a donc rien à faire dans les journaux d'accès. Un partenaire ne peut résoudre que les QR codes émis pour sa propre entreprise ; un `ADMIN` les résout tous. Le QR code n'est pas consommé ici, seul l'encaissement le consomme."
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, description: Hash SHA-256 (64 caractères hexadécimaux) du code scanné. }
 *     responses:
 *       '200':
 *         description: QR code valide.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 salarieId: { type: string, format: uuid }
 *                 name: { type: string }
 *                 surname: { type: string }
 *                 companyId: { type: string, format: uuid }
 *                 expiresAt: { type: string }
 *       '400': { description: Corps de requête invalide, ou QR code expiré. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant, ou QR code émis pour une autre entreprise. }
 *       '404': { description: QR code introuvable, ou salarié introuvable. }
 *       '500': { description: Erreur serveur interne. }
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
