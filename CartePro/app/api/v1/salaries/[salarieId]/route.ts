import { z } from 'zod';
import { db } from '@/lib/prisma/db';
import { authorize, hashPassword, passwordSchema } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { assertCanAccessSalarie, resolveActor } from '@/lib/services/ownership_service';
import { sendEmail } from '@/lib/services/email_service';
import { DEMO_DISCLAIMER, buildLoginLink } from '@/lib/services/account_mail_service';

const paramsSchema = z.object({ salarieId: z.uuid() });

const safeText = (max: number) =>
  z.string().min(1).max(max).regex(/^[^<>'"&]*$/, { message: "Les caractères spéciaux (<, >, ', \", &) sont interdits." });

const salariePatchSchema = z.object({
  email: z.email().optional(),
  surname: safeText(80).optional(),
  name: safeText(80).optional(),
  password: passwordSchema.optional(),
  active: z.boolean().optional(),
  accountStatus: z.enum(['PENDING', 'ACCEPTED', 'REFUSED']).optional(),
}).refine((patch) => Object.keys(patch).length > 0, {
  message: 'Le corps de la requête ne doit pas être vide.',
});

// A salarié editing themselves may only touch these fields. Strict, so a field
// they may not change — `accountStatus` above all — is an explicit 400 rather
// than being quietly dropped when sent alongside a legal one.
const selfPatchSchema = z.object({
  surname: safeText(80).optional(),
  name: safeText(80).optional(),
  password: passwordSchema.optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, {
  message: 'Le corps de la requête ne doit pas être vide.',
});

async function loadSalarie(salarieId: string, includeInactive = false)
{
  const salarie = await db.orm.public.Users.where({ id: salarieId, role: 'EMPLOYEE' }).first();

  if (!salarie || (!includeInactive && salarie.expiredAt !== null))
  {
    throw new AppError('Salarie not found', 404);
  }

  return salarie;
}

/**
 * @openapi
 * /api/v1/salaries/{salarieId}:
 *   get:
 *     tags:
 *       - Salariés
 *     summary: Consultation de la fiche d'un salarié
 *     description: "Retourne les informations du profil d'un salarié. Un salarié (`EMPLOYEE`) ne peut consulter que sa propre fiche ; une entreprise (`COMPANY`) ne consulte que ses propres salariés ; un `ADMIN` peut consulter n'importe quel salarié."
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: salarieId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identifiant du salarié"
 *     responses:
 *       '200':
 *         description: Fiche du salarié récupérée avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - id
 *                 - email
 *                 - surname
 *                 - name
 *                 - balance
 *                 - companyId
 *                 - role
 *                 - createdAt
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: "j.dupont@entreprise.fr"
 *                 surname:
 *                   type: string
 *                   example: "Dupont"
 *                 name:
 *                   type: string
 *                   example: "Jean"
 *                 balance:
 *                   type: integer
 *                   description: "Solde en centimes d'euro"
 *                   example: 12000
 *                 companyId:
 *                   type: string
 *                   format: uuid
 *                   example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *                 role:
 *                   type: string
 *                   example: "EMPLOYEE"
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-09-02T10:00:00.000Z"
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
 *         description: "Accès refusé : consultation non autorisée pour ce compte."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Salarié introuvable ou inactif.
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
export async function GET(request: Request, { params }: { params: Promise<{ salarieId: string }> })
{
  try
  {
    const auth = await authorize(request, 'GET /api/v1/salaries/:salarieId');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { salarieId } = paramsSchema.parse(await params);
    const actor = await resolveActor(auth);
    const salarie = await loadSalarie(salarieId);
    assertCanAccessSalarie(actor, salarie);

    return Response.json({
      id: salarie.id,
      email: salarie.email,
      surname: salarie.surname,
      name: salarie.name,
      balance: salarie.balance,
      companyId: salarie.companyId,
      role: salarie.role,
      createdAt: salarie.createdAt,
    }, { status: 200 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}

/**
 * @openapi
 * /api/v1/salaries/{salarieId}:
 *   patch:
 *     tags:
 *       - Salariés
 *     summary: Mise à jour partielle d'un salarié
 *     description: "Met à jour partiellement un salarié. Un `ADMIN` ou l'entreprise employeuse peut modifier `email`, `surname`, `name`, `password`, `active` et `accountStatus` ; un salarié modifiant sa propre fiche est strictement restreint à `surname`, `name` et `password` (toute tentative de modifier un autre champ renvoie une 400). `active=false` renseigne `expiredAt` et désactive le compte ; `active=true` le réactive.\n\n**Vérification du compte** : faire passer `accountStatus` de `PENDING` à `ACCEPTED` déclenche l'envoi d'un email de validation au salarié avec le lien de connexion. L'email est envoyé *avant* toute écriture : en cas d'échec du service mail, l'API répond une 502 et le compte reste `PENDING`."
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: salarieId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identifiant du salarié"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: "Champs modifiables du profil salarié"
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "j.dupont@entreprise.fr"
 *               surname:
 *                 type: string
 *                 example: "Dupont"
 *               name:
 *                 type: string
 *                 example: "Jean"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: "Nouveau mot de passe conforme aux règles de complexité"
 *                 example: "NouveauSecret123!"
 *               active:
 *                 type: boolean
 *                 description: "Activation ou désactivation logique du compte salarié"
 *                 example: true
 *               accountStatus:
 *                 type: string
 *                 enum: [PENDING, ACCEPTED, REFUSED]
 *                 description: "Réservé ADMIN ou COMPANY. Le passage à ACCEPTED valide le compte et notifie le salarié."
 *                 example: "ACCEPTED"
 *     responses:
 *       '200':
 *         description: Salarié mis à jour avec succès. Le mot de passe haché n'est jamais retourné.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - id
 *                 - email
 *                 - surname
 *                 - name
 *                 - balance
 *                 - companyId
 *                 - role
 *                 - active
 *                 - createdAt
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: "j.dupont@entreprise.fr"
 *                 surname:
 *                   type: string
 *                   example: "Dupont"
 *                 name:
 *                   type: string
 *                   example: "Jean"
 *                 balance:
 *                   type: integer
 *                   description: "Solde en centimes d'euro"
 *                   example: 12000
 *                 companyId:
 *                   type: string
 *                   format: uuid
 *                   example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *                 role:
 *                   type: string
 *                   example: "EMPLOYEE"
 *                 active:
 *                   type: boolean
 *                   example: true
 *                 accountStatus:
 *                   type: string
 *                   example: "ACCEPTED"
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-09-02T10:00:00.000Z"
 *       '400':
 *         description: "Identifiant ou corps de requête invalide, ou tentative de modifier un champ interdit à ce rôle."
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
 *         description: "Rôle insuffisant ou tentative de modifier un salarié d'une autre entreprise."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Salarié introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: Un utilisateur possède déjà cette adresse email.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '502':
 *         description: "Échec d'envoi de l'email de validation : la modification n'a pas été appliquée."
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
export async function PATCH(request: Request, { params }: { params: Promise<{ salarieId: string }> })
{
  try
  {
    const auth = await authorize(request, 'PATCH /api/v1/salaries/:salarieId');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { salarieId } = paramsSchema.parse(await params);

    const actor = await resolveActor(auth);
    const salarie = await loadSalarie(salarieId, actor.role !== 'EMPLOYEE');
    assertCanAccessSalarie(actor, salarie);

    const body = await request.json().catch(() =>
    {
      throw new AppError('Invalid JSON in request body', 400);
    });
    const patch: {
      email?: string;
      surname?: string;
      name?: string;
      password?: string;
      active?: boolean;
      accountStatus?: 'PENDING' | 'ACCEPTED' | 'REFUSED';
    } = actor.role === 'EMPLOYEE' ? selfPatchSchema.parse(body) : salariePatchSchema.parse(body);

    const { email, active } = patch;

    if (email !== undefined)
    {
      const conflict = await db.orm.public.Users.where({ email }).first();

      if (conflict && conflict.id !== salarieId)
      {
        throw new AppError('A user with these identifiers already exists', 409);
      }
    }

    // Account verification: PENDING -> ACCEPTED, and only that transition.
    if (patch.accountStatus === 'ACCEPTED' && salarie.accountStatus === 'PENDING')
    {
      // The mail goes out before anything is written, so a provider failure
      // (502 from the Brevo provider) leaves the salarié PENDING and the
      // verification can simply be retried.
      await sendEmail({
        to: salarie.email,
        subject: 'Votre compte Carte Pro est validé',
        text: [
          `Bonjour ${salarie.name} ${salarie.surname},`,
          '',
          "Votre compte Carte Pro vient d'être validé par l'administration.",
          'Vous pouvez désormais vous connecter avec cette adresse email et le mot de passe',
          'qui vous a été communiqué par votre entreprise :',
          buildLoginLink(),
          '',
          "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
          '',
          DEMO_DISCLAIMER,
        ].join('\n'),
      });
    }

    const { password, active: _active, ...rest } = patch;
    const values = {
      ...rest,
      ...(password === undefined ? {} : { password: hashPassword(password) }),
      ...(active === undefined ? {} : { expiredAt: active ? null : Temporal.Now.instant() }),
    };

    await db.orm.public.Users.where({ id: salarieId }).update(values);

    const updated = await loadSalarie(salarieId, true);
    const { password: _password, ...safe } = updated;

    return Response.json({ ...safe, active: safe.expiredAt === null }, { status: 200 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}

/**
 * @openapi
 * /api/v1/salaries/{salarieId}:
 *   delete:
 *     tags:
 *       - Salariés
 *     summary: Désactivation logique d'un salarié
 *     description: "Suppression logique du salarié : le champ `expiredAt` est horodaté, rendant le compte immédiatement inactif et invalidant les sessions sans supprimer la ligne historique (nécessaire à la traçabilité des transactions). Accessible à un `ADMIN` ou à l'employeur du salarié."
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: salarieId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identifiant du salarié à désactiver"
 *     responses:
 *       '204':
 *         description: Salarié désactivé avec succès (aucun contenu retourné).
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
 *         description: "Rôle insuffisant ou tentative de désactiver le salarié d'une autre entreprise."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Salarié introuvable ou déjà inactif.
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
export async function DELETE(request: Request, { params }: { params: Promise<{ salarieId: string }> })
{
  try
  {
    const auth = await authorize(request, 'DELETE /api/v1/salaries/:salarieId');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { salarieId } = paramsSchema.parse(await params);

    const actor = await resolveActor(auth);
    const salarie = await loadSalarie(salarieId);
    assertCanAccessSalarie(actor, salarie);

    await db.orm.public.Users.where({ id: salarieId }).update({ expiredAt: Temporal.Now.instant() });

    return new Response(null, { status: 204 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}
