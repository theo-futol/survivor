import { db } from '@/lib/prisma/db';
import { commonErrorHandler } from '@/lib/services/error_service';

/**
 * @openapi
 * /api/v1/categories:
 *   get:
 *     tags:
 *       - Catégories
 *     summary: Référentiel des catégories d'activité
 *     description: "Retourne l'ensemble des catégories d'activité professionnelle disponibles pour les entreprises et les partenaires marchands, triées par ordre alphabétique. Endpoint public notamment utilisé par le formulaire d'inscription."
 *     responses:
 *       '200':
 *         description: Liste des catégories récupérée avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - categories
 *               properties:
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     required:
 *                       - id
 *                       - category
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       category:
 *                         type: string
 *                         example: "Restauration"
 *       '500':
 *         description: Erreur serveur interne.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
