import { z } from 'zod';
import { db } from '@/lib/prisma/db';
import { authorize, hashPassword, passwordSchema } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { assertOwnsCompany, resolveActor } from '@/lib/services/ownership_service';
import { buildMeta, parsePagination } from '@/lib/services/pagination';

const safeText = (max: number) =>
  z.string().min(1).max(max).regex(/^[^<>'"&]*$/, { message: "Les caractères spéciaux (<, >, ', \", &) sont interdits." });

const salarieCreateSchema = z.object({
  email: z.email(),
  surname: safeText(80),
  name: safeText(80),
  password: passwordSchema,
  companyId: z.uuid(),
}).strict();

const employeurIdSchema = z.uuid().optional();
const includeInactiveSchema = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');

/**
 * @openapi
 * /api/v1/salaries:
 *   get:
 *     summary: Liste paginée des salariés
 *     description: Retourne les salariés. Par défaut, seuls les comptes actifs (`expiredAt` nul) sont inclus ; `includeInactive=true` permet à l'entreprise ou à l'administrateur d'afficher aussi les comptes désactivés. Chaque salarié est enrichi de son statut `active`, de son statut de bannissement (`isBanned`) ainsi que du nombre et du montant total de ses transactions. Un utilisateur `COMPANY` ne voit que les salariés de sa propre entreprise ; un `ADMIN` les voit tous.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: employeurId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: includeInactive
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       '200':
 *         description: Liste récupérée avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       email: { type: string }
 *                       surname: { type: string }
 *                       name: { type: string }
 *                       balance: { type: integer }
 *                       companyId: { type: string, nullable: true }
 *                       active: { type: boolean }
 *                       isBanned: { type: boolean }
 *                       transactionCount: { type: integer }
 *                       transactionTotal: { type: integer }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *       '400': { description: Paramètres de requête invalides. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant, ou tentative de lister les salariés d'une autre entreprise. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function GET(request: Request)
{
  try
  {
    const auth = await authorize(request, 'GET /api/v1/salaries');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const actor = await resolveActor(auth);
    const url = new URL(request.url);
    const pagination = parsePagination(url);
    const employeurId = employeurIdSchema.parse(url.searchParams.get('employeurId') ?? undefined);
    const includeInactive = includeInactiveSchema.parse(url.searchParams.get('includeInactive') ?? undefined);

    // Non-admins are pinned to their own company whatever they ask for.
    const companyId = actor.role === 'ADMIN' ? employeurId : (actor.companyId ?? '');

    if (companyId !== undefined && actor.role !== 'ADMIN')
    {
      assertOwnsCompany(actor, companyId);
    }

    const scoped = () =>
    {
      const employees = db.orm.public.Users.where({ role: 'EMPLOYEE' });
      const base = includeInactive ? employees : employees.where((u) => u.expiredAt.isNull());

      return companyId === undefined ? base : base.where({ companyId });
    };

    const { total } = await scoped().aggregate((aggregate) => ({ total: aggregate.count() }));
    const salaries = await scoped()
      .select('id', 'email', 'surname', 'name', 'balance', 'companyId', 'createdAt', 'expiredAt', 'accountStatus')
      .orderBy((u) => u.createdAt.desc())
      .limit(pagination.limit)
      .offset(pagination.offset)
      .all();

    const data = await Promise.all(salaries.map(async (salarie) =>
    {
      const banned = await db.orm.public.BannedUser.where({ userId: salarie.id }).first();
      const totals = await db.orm.public.Transaction
        .where({ userId: salarie.id })
        .aggregate((aggregate) => ({
          transactionCount: aggregate.count(),
          transactionTotal: aggregate.sum('amount'),
        }));

      return {
        id: salarie.id,
        email: salarie.email,
        surname: salarie.surname,
        name: salarie.name,
        balance: salarie.balance,
        companyId: salarie.companyId,
        createdAt: salarie.createdAt,
        accountStatus: salarie.accountStatus,
        active: salarie.expiredAt === null,
        isBanned: banned !== null,
        transactionCount: totals.transactionCount,
        transactionTotal: totals.transactionTotal ?? 0,
      };
    }));

    return Response.json({ data, meta: buildMeta(pagination, total) }, { status: 200 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}

/**
 * @openapi
 * /api/v1/salaries:
 *   post:
 *     summary: Création d'un salarié
 *     description: "Crée un salarié rattaché à une entreprise. Le mot de passe est choisi par l'employeur dans le corps de la requête ; il doit respecter les règles de complexité (8 à 32 caractères, une majuscule, une minuscule, un chiffre, un caractère spécial) et n'est stocké que haché. Le serveur impose `role = EMPLOYEE`, `balance = 0`, un compte actif et `accountStatus = PENDING` : la connexion est refusée tant qu'un agent n'a pas vérifié le compte (`PATCH /api/v1/salaries/{salarieId}` avec `accountStatus = ACCEPTED`). Aucun contrat ni document n'est demandé à l'entreprise. Un utilisateur `COMPANY` ne peut créer un salarié que dans sa propre entreprise."
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, surname, name, password, companyId]
 *             properties:
 *               email: { type: string, format: email }
 *               surname: { type: string, description: "Nom de famille (`nom` dans docs/API.md)." }
 *               name: { type: string, description: "Prénom (`prenom` dans docs/API.md)." }
 *               password: { type: string }
 *               companyId: { type: string, format: uuid, description: "Entreprise employeuse (`employeurId` dans docs/API.md)." }
 *     responses:
 *       '201':
 *         description: Salarié créé, au statut `PENDING`. Le mot de passe haché n'est jamais retourné.
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '400': { description: Corps de requête invalide (mot de passe trop faible…), ou champ non accepté (`accountStatus`…). }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant, ou tentative de créer un salarié dans une autre entreprise. }
 *       '404': { description: Entreprise introuvable. }
 *       '409': { description: Un utilisateur possède déjà cet email. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function POST(request: Request)
{
  try
  {
    const auth = await authorize(request, 'POST /api/v1/salaries');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() =>
    {
      throw new AppError('Invalid JSON in request body', 400);
    });
    const input = salarieCreateSchema.parse(body);

    const actor = await resolveActor(auth);
    assertOwnsCompany(actor, input.companyId);

    const company = await db.orm.public.Company.where({ id: input.companyId, active: true }).first();

    if (!company)
    {
      throw new AppError('Company not found', 404);
    }

    const existingEmail = await db.orm.public.Users.where({ email: input.email }).first();

    if (existingEmail)
    {
      throw new AppError('A user with this email already exists', 409);
    }

    // The password is chosen by the employer and communicated to the salarié
    // out of band; only its hash is ever stored. The account is created PENDING
    // and login is refused until an agent verifies it.
    const created = await db.orm.public.Users.create({
      email: input.email,
      surname: input.surname,
      name: input.name,
      companyId: input.companyId,
      password: hashPassword(input.password),
      role: 'EMPLOYEE',
      balance: 0,
      accountStatus: 'PENDING',
    });

    const { password: _password, ...salarie } = created;

    return Response.json(salarie, { status: 201 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}
