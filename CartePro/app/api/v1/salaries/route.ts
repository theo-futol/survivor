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
 *     tags:
 *       - Salariés
 *     summary: Liste paginée des salariés
 *     description: "Retourne les salariés rattachés aux entreprises employeurs. Par défaut, seuls les salariés actifs (`expiredAt` nul) sont inclus ; `includeInactive=true` permet d'afficher également les salariés archivés/désactivés. Chaque fiche est enrichie de l'état d'activité (`active`), du statut de bannissement (`isBanned`), ainsi que du nombre et montant cumulé de ses transactions. Une entreprise `COMPANY` est strictement restreinte à ses propres salariés ; un `ADMIN` consulte l'ensemble du personnel."
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: employeurId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identifiant de l'employeur (réservé ADMIN, ignoré pour COMPANY qui est assigné à son propre compte)"
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: "Inclure les salariés désactivés/supprimés logiquement"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: "Numéro de la page"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: "Nombre de salariés par page"
 *     responses:
 *       '200':
 *         description: Liste des salariés récupérée avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - data
 *                 - meta
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     required:
 *                       - id
 *                       - email
 *                       - surname
 *                       - name
 *                       - balance
 *                       - active
 *                       - isBanned
 *                       - transactionCount
 *                       - transactionTotal
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
 *                       email:
 *                         type: string
 *                         format: email
 *                         example: "j.dupont@entreprise.fr"
 *                       surname:
 *                         type: string
 *                         example: "Dupont"
 *                       name:
 *                         type: string
 *                         example: "Jean"
 *                       balance:
 *                         type: integer
 *                         description: "Solde courant en centimes d'euro"
 *                         example: 12000
 *                       companyId:
 *                         type: string
 *                         format: uuid
 *                         nullable: true
 *                         example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *                       active:
 *                         type: boolean
 *                         example: true
 *                       isBanned:
 *                         type: boolean
 *                         example: false
 *                       transactionCount:
 *                         type: integer
 *                         example: 5
 *                       transactionTotal:
 *                         type: integer
 *                         description: "Total des transactions en centimes d'euro"
 *                         example: 8500
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMetaA'
 *       '400':
 *         description: Paramètres de pagination ou identifiant invalides.
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
 *         description: "Rôle insuffisant ou tentative de consulter les salariés d'une autre entreprise."
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
 *     tags:
 *       - Salariés
 *     summary: Création d'un compte salarié
 *     description: "Crée un compte salarié rattaché à une entreprise employeur. Le mot de passe initial est défini par l'employeur lors de la requête et doit respecter les règles de sécurité (8 à 32 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial). Le compte est initialisé avec `role = EMPLOYEE`, `balance = 0` et `accountStatus = PENDING`. L'accès est bloqué jusqu'à validation par un administrateur (`PATCH /api/v1/salaries/{salarieId}` avec `accountStatus = ACCEPTED`). Une entreprise `COMPANY` ne peut créer de salarié que pour son propre compte."
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - surname
 *               - name
 *               - password
 *               - companyId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "j.dupont@entreprise.fr"
 *               surname:
 *                 type: string
 *                 description: "Nom de famille"
 *                 example: "Dupont"
 *               name:
 *                 type: string
 *                 description: "Prénom"
 *                 example: "Jean"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: "Mot de passe provisoire (8 à 32 caractères, majuscule, minuscule, chiffre, symbole)"
 *                 example: "Secret123!"
 *               companyId:
 *                 type: string
 *                 format: uuid
 *                 description: "Identifiant de l'entreprise employeuse"
 *                 example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *     responses:
 *       '201':
 *         description: Salarié créé avec succès au statut PENDING.
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
 *                 - accountStatus
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
 *                   description: "Solde initial en centimes d'euro"
 *                   example: 0
 *                 companyId:
 *                   type: string
 *                   format: uuid
 *                   example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *                 role:
 *                   type: string
 *                   example: "EMPLOYEE"
 *                 accountStatus:
 *                   type: string
 *                   example: "PENDING"
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-09-02T10:00:00.000Z"
 *       '400':
 *         description: "Corps de requête invalide, mot de passe trop faible ou champs interdits transmis."
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
 *         description: "Rôle insuffisant ou tentative de créer un salarié dans une autre entreprise."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Entreprise employeur introuvable.
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
 *       '500':
 *         description: Erreur serveur interne.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
