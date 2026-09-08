import { z } from 'zod';
import { authorize } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { assertOwnsCompany, resolveActor } from '@/lib/services/ownership_service';
import { companyPatchSchema, softDeleteCompany, updateCompany } from '@/lib/services/company_service';

const paramsSchema = z.object({ employeurId: z.uuid() });

/**
 * @openapi
 * /api/v1/employeurs/{employeurId}:
 *   patch:
 *     summary: Mise à jour d'un employeur
 *     description: Met à jour partiellement un employeur. Un utilisateur `COMPANY` ne peut modifier que sa propre entreprise ; un `ADMIN` peut modifier n'importe laquelle. Les champs `isPartner` et `active` sont pilotés par le serveur et ne peuvent pas être fournis.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeurId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Sous-ensemble non vide des champs de création.
 *     responses:
 *       '200':
 *         description: Employeur mis à jour.
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '400': { description: Identifiant ou corps de requête invalide. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant, ou tentative de modifier une autre entreprise. }
 *       '404': { description: Employeur introuvable. }
 *       '409': { description: Un employeur possède déjà cet email, ce SIRET ou ce KBIS. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ employeurId: string }> })
{
  try
  {
    const auth = await authorize(request, 'PATCH /api/v1/employeurs/:employeurId');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { employeurId } = paramsSchema.parse(await params);

    const actor = await resolveActor(auth);
    assertOwnsCompany(actor, employeurId);

    const body = await request.json().catch(() =>
    {
      throw new AppError('Invalid JSON in request body', 400);
    });
    const patch = companyPatchSchema.parse(body);

    const company = await updateCompany(employeurId, false, patch);

    return Response.json(company, { status: 200 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}

/**
 * @openapi
 * /api/v1/employeurs/{employeurId}:
 *   delete:
 *     summary: Suppression d'un employeur
 *     description: Suppression logique — la ligne est conservée et son champ `active` passe à `false`, car les transactions immuables la référencent. L'employeur disparaît alors de toutes les lectures. Réservé aux administrateurs.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeurId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204': { description: Employeur supprimé. }
 *       '400': { description: Identifiant invalide. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant. }
 *       '404': { description: Employeur introuvable. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ employeurId: string }> })
{
  try
  {
    const auth = await authorize(request, 'DELETE /api/v1/employeurs/:employeurId');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { employeurId } = paramsSchema.parse(await params);

    await softDeleteCompany(employeurId, false);

    return new Response(null, { status: 204 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}
