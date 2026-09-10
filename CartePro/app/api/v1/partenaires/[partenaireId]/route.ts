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
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: partenaireId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identifiant unique du partenaire marchand"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: "Sous-ensemble non vide des champs modifiables du partenaire"
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Le Bistrot Gourmand & Co"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contact@bistrotgourmand.fr"
 *               siret:
 *                 type: string
 *                 pattern: '^\\d{14}$'
 *                 example: "98765432109876"
 *               address:
 *                 type: string
 *                 example: "10 place du Marché"
 *               postalCode:
 *                 type: string
 *                 pattern: '^\\d{5}$'
 *                 example: "13001"
 *               description:
 *                 type: string
 *                 example: "Restaurant bistronomique et terrasse"
 *               categoryId:
 *                 type: integer
 *                 example: 1
 *               location:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                     example: 43.297
 *                   lng:
 *                     type: number
 *                     example: 5.372
 *               verified:
 *                 type: boolean
 *                 description: "Réservé ADMIN : valide le partenaire marchand et active son compte utilisateur"
 *                 example: true
 *     responses:
 *       '200':
 *         description: Partenaire mis à jour avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CompanyDetail'
 *       '400':
 *         description: Identifiant ou corps de requête invalide (ou tentative de modifier un champ interdit).
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
 *         description: "Rôle insuffisant ou tentative de modifier un autre partenaire marchand / modifier un champ d'administration."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Partenaire introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: "Un partenaire possède déjà cette adresse email, ce SIRET ou ce document KBIS."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '502':
 *         description: "Échec de l'envoi de l'email de validation : la modification n'a pas été enregistrée."
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
 *     tags:
 *       - Partenaires
 *     summary: Suppression logique d'un partenaire marchand
 *     description: "Suppression logique : le champ `active` passe à `false`. La ligne est conservée en base de données pour garantir l'intégrité référentielle de l'historique des encaissements et transactions passées. Réservé aux administrateurs."
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: partenaireId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identifiant unique du partenaire marchand à supprimer"
 *     responses:
 *       '204':
 *         description: Partenaire désactivé avec succès (aucun contenu retourné).
 *       '400':
 *         description: Identifiant UUID invalide.
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
 *         description: Partenaire introuvable.
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
