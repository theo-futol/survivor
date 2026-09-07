import { z } from 'zod';
import { db } from '@/lib/prisma/db';
import { authorize, hashPassword, passwordSchema } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { assertCanAccessSalarie, resolveActor } from '@/lib/services/ownership_service';
import { sendEmail } from '@/lib/services/email_service';

const paramsSchema = z.object({ salarieId: z.uuid() });

// Read at call time, not at module load, so importing this route stays free of
// environment assumptions during tests and `next build`.
function buildLoginLink(): string
{
  const baseUrl = process.env['APP_BASE_URL'] ?? 'http://localhost:3000';

  return `${baseUrl.replace(/\/+$/, '')}/login`;
}

const safeText = (max: number) =>
  z.string().min(1).max(max).regex(/^[^<>'"&]*$/, { message: "Les caractères spéciaux (<, >, ', \", &) sont interdits." });

const salariePatchSchema = z.object({
  email: z.email().optional(),
  surname: safeText(80).optional(),
  name: safeText(80).optional(),
  password: passwordSchema.optional(),
  active: z.boolean().optional(),
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
 *     summary: Récupération d'un salarié
 *     description: Un salarié peut consulter uniquement sa propre fiche. Une entreprise peut consulter ses salariés et un administrateur peut consulter tous les salariés.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: salarieId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200': { description: Salarié récupéré. }
 *       '401': { description: Session ou token invalide. }
 *       '403': { description: Accès interdit. }
 *       '404': { description: Salarié introuvable. }
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
 *     summary: Mise à jour d'un salarié
 *     description: "Met à jour partiellement un salarié. Un `ADMIN` ou l'entreprise employeuse peut modifier `email`, `surname`, `name`, `documentId`, `password` et `active` ; un salarié modifiant sa propre fiche est limité à `surname`, `name` et `password`. `active=false` renseigne `expiredAt` et désactive le compte ; `active=true` remet `expiredAt` à null."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: salarieId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *               surname: { type: string }
 *               name: { type: string }
 *               password: { type: string }
 *               active: { type: boolean }
 *     responses:
 *       '200':
 *         description: Salarié mis à jour. Le mot de passe haché n'est jamais retourné.
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '400': { description: Identifiant ou corps de requête invalide, ou champ interdit à un salarié. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant, ou tentative de modifier un autre salarié. }
 *       '404': { description: Salarié introuvable. }
 *       '409': { description: Un utilisateur possède déjà cet email. }
 *       '502': { description: L'email de validation n'a pas pu être envoyé ; aucune modification n'a été enregistrée. }
 *       '500': { description: Erreur serveur interne. }
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
    const patch: { email?: string; surname?: string; name?: string; documentId?: string; password?: string; active?: boolean } =
      actor.role === 'EMPLOYEE' ? selfPatchSchema.parse(body) : salariePatchSchema.parse(body);

    const { email, documentId, active } = patch;

    if (email !== undefined)
    {
      const conflict = await db.orm.public.Users.where({ email }).first();

      if (conflict && conflict.id !== salarieId)
      {
        throw new AppError('A user with these identifiers already exists', 409);
      }
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
 *     summary: Suppression d'un salarié
 *     description: Suppression logique — la ligne est conservée et son champ `expiredAt` est daté, car les transactions immuables la référencent. Le salarié disparaît alors de toutes les lectures. Accessible à un `ADMIN` ou à l'entreprise employeuse.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: salarieId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204': { description: Salarié supprimé. }
 *       '400': { description: Identifiant invalide. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant, ou tentative de supprimer le salarié d'une autre entreprise. }
 *       '404': { description: Salarié introuvable. }
 *       '500': { description: Erreur serveur interne. }
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
