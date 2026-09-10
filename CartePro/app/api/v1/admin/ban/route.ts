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
 *     tags:
 *       - Administration
 *     summary: Bannissement immédiat d'un utilisateur
 *     description: "Bannit un utilisateur et révoque immédiatement ses accès. L'interdiction est inscrite à la fois dans la table persistante `bannedUser` et dans le cache Redis consulté à chaque requête par le middleware de sécurité `authorize()`, invalidant sur-le-champ son jeton JWT actif. Réservé aux administrateurs."
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - reason
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: "Identifiant unique de l'utilisateur à révoquer"
 *                 example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: "Motif argumenté de l'exclusion"
 *                 example: "Suspicion de fraude transactionnelle"
 *     responses:
 *       '200':
 *         description: Utilisateur révoqué et banni avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - status
 *                 - userId
 *                 - reason
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "banned"
 *                 userId:
 *                   type: string
 *                   format: uuid
 *                   example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
 *                 reason:
 *                   type: string
 *                   example: "Suspicion de fraude transactionnelle"
 *       '400':
 *         description: Corps de requête invalide ou identifiant non conforme.
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
 *         description: Réservé aux administrateurs.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Utilisateur introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: Utilisateur déjà banni.
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
