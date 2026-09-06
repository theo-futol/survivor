import { db } from '@/lib/prisma/db';
import { authorize } from '@/lib/services/auth_service';
import { commonErrorHandler } from '@/lib/services/error_service';

/**
 * @openapi
 * /api/v1/me:
 *   get:
 *     summary: Récupérer l'utilisateur connecté
 *     description: Retourne l'utilisateur authentifié à partir du JWT envoyé en Bearer ou du cookie de session web.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Utilisateur connecté.
 *       '401':
 *         description: Token manquant ou invalide.
 *       '403':
 *         description: Compte révoqué.
 *       '404':
 *         description: Utilisateur introuvable.
 *       '503':
 *         description: Service d'authentification temporairement indisponible.
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
          isFeatured: companyRow.isFeatured,
          isPartner: companyRow.isPartner,
          categoryId: companyRow.categoryId,
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
