import { z } from 'zod';
import { authorize } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { assertCanEditAdminFields, assertOwnsCompany, resolveActor } from '@/lib/services/ownership_service';
import { companyPatchSchema, getCompany, setCompanyOwnerAccountStatus, softDeleteCompany, updateCompany } from '@/lib/services/company_service';
import { sendCompanyVerifiedEmail } from '@/lib/services/account_mail_service';

const paramsSchema = z.object({ partenaireId: z.uuid() });

/**
 * @openapi
 * /api/v1/partenaires/{partenaireId}:
 *   patch:
 *     summary: Mise à jour d'un partenaire
 *     description: Met à jour partiellement un partenaire. Un utilisateur `PARTNER` ne peut modifier que sa propre fiche ; un `ADMIN` peut modifier n'importe laquelle. Le champ `isPartner` est piloté par le serveur et ne peut jamais être fourni. Les champs `verified`, `active`, `agentId`, `reasonId` et `kbisId` relèvent de la validation administrative : seul un `ADMIN` peut les fournir, sous peine de 403. Le passage de `verified` à `true` envoie un email de validation au partenaire et fait passer à `ACCEPTED` le compte utilisateur créé avec lui à l'inscription, qui peut alors se connecter ; repasser `verified` à `false` le remet à `PENDING`. `active` suspend ou réactive le compte : un partenaire suspendu (`active = false`) disparaît des listings publics et son compte ne peut plus se connecter, sans perdre son historique ; le repasser à `true` le restaure intégralement.
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
 *       '502': { description: L'email de validation n'a pas pu être envoyé ; le partenaire reste non vérifié. }
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

    assertCanEditAdminFields(actor, patch);

    if (patch.verified !== undefined)
    {
      const current = await getCompany(partenaireId, true, true);

      if (patch.verified && !current.verified)
      {
        // The mail goes out before anything is written, so a provider failure
        // (502 from the Brevo provider) leaves the partner unverified and the
        // validation can simply be retried.
        await sendCompanyVerifiedEmail({ name: current.name, email: current.email });
      }
    }

    const partner = await updateCompany(partenaireId, true, patch);

    if (patch.verified !== undefined)
    {
      // Login only ever consults `accountStatus`, so validating the company has
      // to activate the account registered with it — and suspend it again when
      // the validation is revoked. Written on every `verified` patch, not just
      // on the transition: re-sending the patch then repairs a half-applied
      // validation without mailing the partner twice.
      await setCompanyOwnerAccountStatus(partenaireId, patch.verified ? 'ACCEPTED' : 'PENDING');
    }

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
