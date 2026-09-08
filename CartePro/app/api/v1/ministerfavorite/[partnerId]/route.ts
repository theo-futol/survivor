import { z } from 'zod';
import { db } from '@/lib/prisma/db';
import { authorize } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import type { RouteKey } from '@/lib/roles-config';

const paramsSchema = z.object({ partnerId: z.uuid() });

async function removeFavorite(request: Request, params: Promise<{ partnerId: string }>, routeKey: RouteKey)
{
  try
  {
    const auth = await authorize(request, routeKey);

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { partnerId } = paramsSchema.parse(await params);

    const existing = await db.orm.public.MinisterFavorite.where({ companyId: partnerId }).first();

    if (!existing)
    {
      throw new AppError('Partner is not in the favorite list', 404);
    }

    await db.orm.public.MinisterFavorite.where({ companyId: partnerId }).delete();

    return Response.json({ status: 'removed', partnerId }, { status: 200 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}

/**
 * @openapi
 * /api/v1/ministerfavorite/{partnerId}:
 *   patch:
 *     summary: Retrait d'un partenaire des favoris du ministre
 *     description: Retire un partenaire de la liste des favoris du ministre. Identique à `DELETE` sur la même route, les deux verbes étant décrits par docs/API.md avec le même comportement. Réservé aux administrateurs.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Partenaire retiré des favoris.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: removed }
 *                 partnerId: { type: string }
 *       '400': { description: Identifiant invalide. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant. }
 *       '404': { description: Partenaire absent de la liste des favoris. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ partnerId: string }> })
{
  return removeFavorite(request, params, 'PATCH /api/v1/ministerfavorite/:partnerId');
}

/**
 * @openapi
 * /api/v1/ministerfavorite/{partnerId}:
 *   delete:
 *     summary: Retrait d'un partenaire des favoris du ministre
 *     description: Retire un partenaire de la liste des favoris du ministre. Identique à `PATCH` sur la même route. Réservé aux administrateurs.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Partenaire retiré des favoris.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: removed }
 *                 partnerId: { type: string }
 *       '400': { description: Identifiant invalide. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant. }
 *       '404': { description: Partenaire absent de la liste des favoris. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ partnerId: string }> })
{
  return removeFavorite(request, params, 'DELETE /api/v1/ministerfavorite/:partnerId');
}
