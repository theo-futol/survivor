import { z } from 'zod';
import { db } from '@/lib/prisma/db';
import { authorize, hashPassword } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { assertCanAccessSalarie, resolveActor } from '@/lib/services/ownership_service';

const paramsSchema = z.object({ salarieId: z.uuid() });

const safeText = (max: number) =>
  z.string().min(1).max(max).regex(/^[^<>'"&]*$/, { message: "Les caractères spéciaux (<, >, ', \", &) sont interdits." });

const passwordSchema = z.string()
  .min(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  .max(32, { message: 'Le mot de passe ne doit pas dépasser 32 caractères.' })
  .regex(/[A-Z]/, { message: 'Le mot de passe doit contenir au moins une lettre majuscule.' })
  .regex(/[a-z]/, { message: 'Le mot de passe doit contenir au moins une lettre minuscule.' })
  .regex(/[0-9]/, { message: 'Le mot de passe doit contenir au moins un chiffre.' })
  .regex(/[^A-Za-z0-9]/, { message: 'Le mot de passe doit contenir au moins un caractère spécial.' });

const salariePatchSchema = z.object({
  email: z.email().optional(),
  surname: safeText(80).optional(),
  name: safeText(80).optional(),
  documentId: z.uuid().optional(),
  password: passwordSchema.optional(),
}).refine((patch) => Object.keys(patch).length > 0, {
  message: 'Le corps de la requête ne doit pas être vide.',
});

// A salarié editing themselves may only touch these fields.
const selfPatchSchema = z.object({
  surname: safeText(80).optional(),
  name: safeText(80).optional(),
  password: passwordSchema.optional(),
}).refine((patch) => Object.keys(patch).length > 0, {
  message: 'Le corps de la requête ne doit pas être vide.',
});

async function loadSalarie(salarieId: string)
{
  const salarie = await db.orm.public.Users.where({ id: salarieId, role: 'EMPLOYEE' }).first();

  if (!salarie || salarie.expiredAt !== null)
  {
    throw new AppError('Salarie not found', 404);
  }

  return salarie;
}

/**
 * @openapi
 * /api/v1/salaries/{salarieId}:
 *   patch:
 *     summary: Mise à jour d'un salarié
 *     description: "Met à jour partiellement un salarié. Un `ADMIN` ou l'entreprise employeuse peut modifier `email`, `surname`, `name`, `documentId` et `password` ; un salarié modifiant sa propre fiche est limité à `surname`, `name` et `password`. Le mot de passe est haché avant stockage ; `role`, `balance`, `companyId` et `expiredAt` sont pilotés par le serveur."
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
 *               documentId: { type: string, format: uuid }
 *               password: { type: string }
 *     responses:
 *       '200':
 *         description: Salarié mis à jour. Le mot de passe haché n'est jamais retourné.
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '400': { description: Identifiant ou corps de requête invalide. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant, ou tentative de modifier un autre salarié. }
 *       '404': { description: Salarié introuvable. }
 *       '409': { description: Un utilisateur possède déjà cet email ou ce document. }
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
    const salarie = await loadSalarie(salarieId);
    assertCanAccessSalarie(actor, salarie);

    const body = await request.json().catch(() =>
    {
      throw new AppError('Invalid JSON in request body', 400);
    });
    const patch: { email?: string; surname?: string; name?: string; documentId?: string; password?: string } =
      actor.role === 'EMPLOYEE' ? selfPatchSchema.parse(body) : salariePatchSchema.parse(body);

    const { email, documentId } = patch;

    for (const condition of [
      ...(email === undefined ? [] : [{ email }]),
      ...(documentId === undefined ? [] : [{ documentId }]),
    ])
    {
      const conflict = await db.orm.public.Users.where(condition).first();

      if (conflict && conflict.id !== salarieId)
      {
        throw new AppError('A user with these identifiers already exists', 409);
      }
    }

    const { password, ...rest } = patch;
    const values = password === undefined ? rest : { ...rest, password: hashPassword(password) };

    await db.orm.public.Users.where({ id: salarieId }).update(values);

    const updated = await loadSalarie(salarieId);
    const { password: _password, ...safe } = updated;

    return Response.json(safe, { status: 200 });
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
