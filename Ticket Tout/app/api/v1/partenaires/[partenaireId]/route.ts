import { z } from 'zod';
import { authorize } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { assertOwnsCompany, resolveActor } from '@/lib/services/ownership_service';
import { companyPatchSchema, softDeleteCompany, updateCompany } from '@/lib/services/company_service';

const paramsSchema = z.object({ partenaireId: z.uuid() });

/**
 * @openapi
 * /api/v1/partenaires/{partenaireId}:
 *   patch:
 *     summary: Mise à jour d'un partenaire
 *     description: Met à jour partiellement un partenaire. Un utilisateur `PARTNER` ne peut modifier que sa propre fiche ; un `ADMIN` peut modifier n'importe laquelle. Les champs `isPartner` et `active` sont pilotés par le serveur et ne peuvent pas être fournis.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partenaireId
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
 *         description: Partenaire mis à jour.
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '400': { description: Identifiant ou corps de requête invalide. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant, ou tentative de modifier un autre partenaire. }
 *       '404': { description: Partenaire introuvable. }
 *       '409': { description: Un partenaire possède déjà cet email, ce SIRET ou ce KBIS. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ partenaireId: string }> })
{
  try
  {
    const auth = await authorize(request, 'PATCH /api/v1/partenaires/:partenaireId');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { partenaireId } = paramsSchema.parse(await params);

    const actor = await resolveActor(auth);
    assertOwnsCompany(actor, partenaireId);

    const body = await request.json().catch(() =>
    {
      throw new AppError('Invalid JSON in request body', 400);
    });
    const patch = companyPatchSchema.parse(body);

    const partner = await updateCompany(partenaireId, true, patch);

    return Response.json(partner, { status: 200 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}

/**
 * @openapi
 * /api/v1/partenaires/{partenaireId}:
 *   delete:
 *     summary: Suppression d'un partenaire
 *     description: Suppression logique — la ligne est conservée et son champ `active` passe à `false`, car les transactions immuables la référencent. Le partenaire disparaît alors de toutes les lectures. Réservé aux administrateurs.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partenaireId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204': { description: Partenaire supprimé. }
 *       '400': { description: Identifiant invalide. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant. }
 *       '404': { description: Partenaire introuvable. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ partenaireId: string }> })
{
  try
  {
    const auth = await authorize(request, 'DELETE /api/v1/partenaires/:partenaireId');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { partenaireId } = paramsSchema.parse(await params);

    await softDeleteCompany(partenaireId, true);

    return new Response(null, { status: 204 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}
