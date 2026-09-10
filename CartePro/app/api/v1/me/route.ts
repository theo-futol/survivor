import { db } from '@/lib/prisma/db';
import { authorize } from '@/lib/services/auth_service';
import { commonErrorHandler } from '@/lib/services/error_service';

/**
 * @openapi
 * /api/v1/me:
 *   get:
 *     tags:
 *       - Utilisateurs
 *     summary: Récupérer le profil de l'utilisateur connecté
 *     description: "Retourne les informations du compte utilisateur authentifié (à partir de l'en-tête `Authorization: Bearer <token>` ou du cookie `cartepro_token`) ainsi que les informations de son entreprise de rattachement le cas échéant."
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       '200':
 *         description: Profil de l'utilisateur récupéré avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - user
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/UserSummary'
 *                 company:
 *                   allOf:
 *                     - $ref: '#/components/schemas/CompanyDetail'
 *                   nullable: true
 *       '401':
 *         description: Jeton JWT manquant, expiré ou invalide.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Compte banni ou révoqué.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Utilisateur introuvable ou compte désactivé.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '503':
 *         description: Service d'authentification temporairement indisponible (base de données ou Redis).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export async function GET(request: Request)
{
  try
  {
    const auth = await authorize(request, 'GET /api/v1/me');
    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const user = await db.orm.public.Users
      .where({ id: auth.sub })
      .select('id', 'email', 'surname', 'name', 'role', 'balance', 'companyId', 'createdAt', 'expiredAt')
      .first();

    if (!user || user.expiredAt !== null)
    {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const companyRow = user.companyId
      ? await db.orm.public.Company.where({ id: user.companyId, active: true }).first()
      : null;
    const companyCategory = companyRow
      ? await db.orm.public.CompanyCategory.where({ id: companyRow.categoryId }).first()
      : null;
    const company = companyRow
      ? {
          id: companyRow.id,
          name: companyRow.name,
          email: companyRow.email,
          siret: companyRow.siret,
          address: companyRow.address,
          postalCode: companyRow.postalCode,
          verified: companyRow.verified,
          isPartner: companyRow.isPartner,
          categoryId: companyRow.categoryId,
          description: companyRow.description,
          category: companyCategory ? { id: companyCategory.id, category: companyCategory.category } : null,
        }
      : null;

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        surname: user.surname,
        name: user.name,
        role: user.role,
        balance: user.balance,
        companyId: user.companyId,
        createdAt: user.createdAt,
      },
      company,
    });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}
