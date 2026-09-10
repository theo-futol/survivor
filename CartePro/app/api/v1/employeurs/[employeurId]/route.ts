import { z } from 'zod';
import { authorize } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { assertCanEditAdminFields, assertOwnsCompany, resolveActor } from '@/lib/services/ownership_service';
import { companyPatchSchema, getCompany, setCompanyOwnerAccountStatus, softDeleteCompany, updateCompany } from '@/lib/services/company_service';
import { sendCompanyVerifiedEmail } from '@/lib/services/account_mail_service';

const paramsSchema = z.object({ employeurId: z.uuid() });

/**
 * @openapi
 * /api/v1/employeurs/{employeurId}:
 *   patch:
 *     summary: Mise à jour d'un employeur
 *     description: Met à jour partiellement un employeur. Un utilisateur `COMPANY` ne peut modifier que sa propre entreprise ; un `ADMIN` peut modifier n'importe laquelle. Le champ `isPartner` est piloté par le serveur et ne peut jamais être fourni. Les champs `verified`, `active`, `agentId`, `reasonId` et `kbisId` relèvent de la validation administrative : seul un `ADMIN` peut les fournir, sous peine de 403. Le passage de `verified` à `true` envoie un email de validation à l'entreprise et fait passer à `ACCEPTED` le compte utilisateur créé avec elle à l'inscription, qui peut alors se connecter ; repasser `verified` à `false` le remet à `PENDING`. `active` suspend ou réactive le compte : un employeur suspendu (`active = false`) disparaît des listings et son compte ne peut plus se connecter, sans perdre son historique ni celui de ses salariés ; le repasser à `true` le restaure intégralement. Les comptes salariés ne sont pas touchés par ce champ : ils relèvent de leur propre statut `active`.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: employeurId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identifiant unique de l'employeur"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: "Sous-ensemble non vide des champs modifiables de l'employeur"
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Entreprise SA Nouvelle Dénomination"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "direction@entreprise.fr"
 *               siret:
 *                 type: string
 *                 pattern: '^\\d{14}$'
 *                 example: "12345678901234"
 *               address:
 *                 type: string
 *                 example: "14 boulevard Maritime"
 *               postalCode:
 *                 type: string
 *                 pattern: '^\\d{5}$'
 *                 example: "13002"
 *               description:
 *                 type: string
 *                 example: "Nouvelle description d'activité"
 *               categoryId:
 *                 type: integer
 *                 example: 2
 *               location:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                     example: 43.3
 *                   lng:
 *                     type: number
 *                     example: 5.4
 *               verified:
 *                 type: boolean
 *                 description: "Réservé ADMIN : valide l'employeur et active le compte utilisateur associé"
 *                 example: true
 *     responses:
 *       '200':
 *         description: Employeur mis à jour avec succès.
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
 *         description: "Rôle insuffisant ou tentative de modifier l'entreprise d'un tiers / modifier un champ réservé à l'administrateur."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Employeur introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: "Un employeur possède déjà cette adresse email, ce SIRET ou ce document KBIS."
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

    assertCanEditAdminFields(actor, patch);

    if (patch.verified !== undefined)
    {
      const current = await getCompany(employeurId, false, true);

      if (patch.verified && !current.verified)
      {
        // The mail goes out before anything is written, so a provider failure
        // (502 from the Brevo provider) leaves the employer unverified and the
        // validation can simply be retried.
        await sendCompanyVerifiedEmail({ name: current.name, email: current.email });
      }
    }

    const company = await updateCompany(employeurId, false, patch);

    if (patch.verified !== undefined)
    {
      // Login only ever consults `accountStatus`, so validating the company has
      // to activate the account registered with it — and suspend it again when
      // the validation is revoked. Written on every `verified` patch, not just
      // on the transition: re-sending the patch then repairs a half-applied
      // validation without mailing the employer twice.
      await setCompanyOwnerAccountStatus(employeurId, patch.verified ? 'ACCEPTED' : 'PENDING');
    }

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
 *     tags:
 *       - Employeurs
 *     summary: Suppression logique d'un employeur
 *     description: "Suppression logique : le statut `active` passe à `false`. La ligne est conservée en base de données pour garantir l'intégrité référentielle des transactions passées, mais disparaît des requêtes de consultation. Réservé aux administrateurs."
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: employeurId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identifiant unique de l'employeur à supprimer"
 *     responses:
 *       '204':
 *         description: Employeur désactivé avec succès (aucun contenu retourné).
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
 *         description: Employeur introuvable.
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
