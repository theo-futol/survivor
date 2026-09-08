import { z } from 'zod';
import { db } from '@/lib/prisma/db';
import { authorize } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { banUser } from '@/lib/services/redis_service';

const banSchema = z.object({
  userId: z.uuid(),
  reason: z.string().min(1).max(500).regex(/^[^<>'"&]*$/, {
    message: "Les caractères spéciaux (<, >, ', \", &) sont interdits.",
  }),
});

/**
 * @openapi
 * /api/v1/admin/ban:
 *   post:
 *     summary: Bannissement d'un utilisateur
 *     description: "Bannit un utilisateur pour le motif indiqué. Le bannissement est écrit à deux endroits : la table `BannedUser`, qui fait foi pour les lectures (par exemple le champ `isBanned` de `GET /api/v1/salaries`), et une clé Redis à durée de vie limitée que `authorize()` consulte à chaque requête, ce qui invalide immédiatement le token de l'utilisateur. Réservé aux administrateurs."
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, reason]
 *             properties:
 *               userId: { type: string, format: uuid }
 *               reason: { type: string, maxLength: 500 }
 *     responses:
 *       '200':
 *         description: Utilisateur banni.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: banned }
 *                 userId: { type: string }
 *                 reason: { type: string }
 *       '400': { description: Corps de requête invalide. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant. }
 *       '404': { description: Utilisateur introuvable. }
 *       '409': { description: Utilisateur déjà banni. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function POST(request: Request)
{
  try
  {
    const auth = await authorize(request, 'POST /api/v1/admin/ban');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() =>
    {
      throw new AppError('Invalid JSON in request body', 400);
    });
    const { userId, reason } = banSchema.parse(body);

    const user = await db.orm.public.Users.where({ id: userId }).first();

    if (!user)
    {
      throw new AppError('User not found', 404);
    }

    const existing = await db.orm.public.BannedUser.where({ userId }).first();

    if (existing)
    {
      throw new AppError('User is already banned', 409);
    }

    await db.orm.public.BannedUser.create({ userId, reason });
    await banUser(userId);

    return Response.json({ status: 'banned', userId, reason }, { status: 200 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}
