import { z } from 'zod';
import { db } from '@/lib/prisma/db';
import { authorize } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';

const favoriteSchema = z.object({ partnerId: z.uuid() });

/**
 * @openapi
 * /api/v1/ministerfavorite:
 *   get:
 *     summary: Liste des partenaires favoris du ministre
 *     description: Retourne les partenaires présents dans la liste des favoris du ministre, avec le nom de chaque entreprise. Réservé aux administrateurs.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Liste récupérée avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 favorites:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       partnerId: { type: string }
 *                       name: { type: string }
 *                       likeAmount: { type: integer }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function GET(request: Request)
{
  try
  {
    const auth = await authorize(request, 'GET /api/v1/ministerfavorite');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const rows = await db.orm.public.MinisterFavorite
      .include('company', (company) => company.select('id', 'name'))
      .orderBy((favorite) => favorite.createdAt.desc())
      .all();

    const favorites = rows.map((row) => ({
      partnerId: row.companyId,
      name: row.company.name,
      likeAmount: row.likeAmount,
    }));

    return Response.json({ favorites }, { status: 200 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}

/**
 * @openapi
 * /api/v1/ministerfavorite:
 *   post:
 *     summary: Ajout d'un partenaire aux favoris du ministre
 *     description: Ajoute un partenaire actif à la liste des favoris du ministre. Réservé aux administrateurs.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [partnerId]
 *             properties:
 *               partnerId: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Partenaire ajouté aux favoris.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: added }
 *                 partnerId: { type: string }
 *       '400': { description: Corps de requête invalide. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant. }
 *       '404': { description: Partenaire introuvable. }
 *       '409': { description: Partenaire déjà dans les favoris. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function POST(request: Request)
{
  try
  {
    const auth = await authorize(request, 'POST /api/v1/ministerfavorite');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() =>
    {
      throw new AppError('Invalid JSON in request body', 400);
    });
    const { partnerId } = favoriteSchema.parse(body);

    const partner = await db.orm.public.Company.where({ id: partnerId, isPartner: true, active: true }).first();

    if (!partner)
    {
      throw new AppError('Partner not found', 404);
    }

    const existing = await db.orm.public.MinisterFavorite.where({ companyId: partnerId }).first();

    if (existing)
    {
      throw new AppError('Partner is already in the favorite list', 409);
    }

    await db.orm.public.MinisterFavorite.create({ companyId: partnerId, likeAmount: 0 });

    return Response.json({ status: 'added', partnerId }, { status: 200 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}
