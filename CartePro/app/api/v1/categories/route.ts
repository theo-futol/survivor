import { db } from '@/lib/prisma/db';
import { commonErrorHandler } from '@/lib/services/error_service';

/**
 * @openapi
 * /api/v1/categories:
 *   get:
 *     summary: Lister les catégories d'entreprise
 *     description: Retourne les catégories disponibles pour une entreprise ou un partenaire. Route publique, consommée notamment par le formulaire d'inscription professionnelle.
 *     responses:
 *       '200':
 *         description: Liste des catégories, triée par libellé.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       category: { type: string }
 *       '500': { description: Erreur serveur interne. }
 */
export async function GET()
{
  try
  {
    const categories = await db.orm.public.CompanyCategory
      .select('id', 'category')
      .orderBy((c) => c.category.asc())
      .all();

    return Response.json({ categories }, { status: 200 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}
