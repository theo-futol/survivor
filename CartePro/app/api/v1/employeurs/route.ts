import { z } from 'zod';
import { authorize } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { resolveActor } from '@/lib/services/ownership_service';
import { buildMeta, parsePagination } from '@/lib/services/pagination';
import { companyCreateSchema, createCompany, listCompanies } from '@/lib/services/company_service';

const searchSchema = z.string().max(120).regex(/^[^<>'"&]*$/).optional();
const includeInactiveSchema = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');

/**
 * @openapi
 * /api/v1/employeurs:
 *   get:
 *     tags:
 *       - Employeurs
 *     summary: Liste paginée des employeurs
 *     description: Retourne les employeurs actifs (entreprises dont `isPartner` vaut `false`). Les employeurs suspendus (`active = false`) sont exclus, sauf pour un `ADMIN` passant `includeInactive=true` — seul moyen de retrouver un compte suspendu pour le réactiver. Un utilisateur `COMPANY` ne voit que sa propre entreprise ; un `ADMIN` les voit toutes.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema: { type: boolean, default: false }
 *         description: Réservé à `ADMIN` — inclut aussi les employeurs suspendus.
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
 *         description: "Nombre d'employeurs par page (max 100)"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: "Filtre de recherche textuelle insensible à la casse sur la raison sociale de l'entreprise"
 *     responses:
 *       '200':
 *         description: Liste paginée des employeurs récupérée avec succès.
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
 *                     $ref: '#/components/schemas/CompanyDetail'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMetaA'
 *       '400':
 *         description: Paramètres de pagination ou de recherche invalides.
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
 *         description: Rôle insuffisant pour accéder à cette ressource.
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
    const auth = await authorize(request, 'GET /api/v1/employeurs');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const actor = await resolveActor(auth);
    const url = new URL(request.url);
    const pagination = parsePagination(url);
    const search = searchSchema.parse(url.searchParams.get('search') ?? undefined);
    const includeInactive = includeInactiveSchema.parse(url.searchParams.get('includeInactive') ?? undefined);

    const { data, total } = await listCompanies({
      isPartner: false,
      pagination,
      search,
      id: actor.role === 'ADMIN' ? undefined : (actor.companyId ?? '') ,
      includeInactive: actor.role === 'ADMIN' && includeInactive,
    });

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
 * /api/v1/employeurs:
 *   post:
 *     tags:
 *       - Employeurs
 *     summary: Création administrative d'un employeur
 *     description: "Crée une entreprise employeur (`isPartner = false`). Tous les champs non nullables de la table `Company` sont requis, y compris `kbisId` qui doit référencer un document KBIS déjà existant. Réservé aux administrateurs. Le champ `verified` n'est pas acceptable à la création : toute inscription crée un employeur non vérifié, validé ensuite via `PATCH`."
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - siret
 *               - kbisId
 *               - address
 *               - postalCode
 *               - agentId
 *               - reasonId
 *               - categoryId
 *               - location
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Entreprise SA"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contact@entreprise.fr"
 *               siret:
 *                 type: string
 *                 pattern: '^\\d{14}$'
 *                 description: "Numéro SIRET à 14 chiffres"
 *                 example: "12345678901234"
 *               kbisId:
 *                 type: string
 *                 format: uuid
 *                 description: "Identifiant UUID du document KBIS préalablement téléversé"
 *                 example: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 *               address:
 *                 type: string
 *                 example: "12 rue de la République"
 *               postalCode:
 *                 type: string
 *                 pattern: '^\\d{5}$'
 *                 example: "13001"
 *               agentId:
 *                 type: integer
 *                 description: "Identifiant de l'agent créateur"
 *                 example: 1
 *               reasonId:
 *                 type: integer
 *                 description: "Identifiant du motif d'inscription"
 *                 example: 1
 *               categoryId:
 *                 type: integer
 *                 description: "Identifiant de la catégorie professionnelle"
 *                 example: 1
 *               description:
 *                 type: string
 *                 example: "Services informatiques"
 *               location:
 *                 type: object
 *                 required:
 *                   - lat
 *                   - lng
 *                 properties:
 *                   lat:
 *                     type: number
 *                     example: 43.2965
 *                   lng:
 *                     type: number
 *                     example: 5.3698
 *     responses:
 *       '201':
 *         description: Entreprise employeur créée avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CompanyDetail'
 *       '400':
 *         description: Corps de requête invalide ou données manquantes.
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
 *       '409':
 *         description: "Un employeur possède déjà cette adresse email, ce SIRET ou ce document KBIS."
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
    const auth = await authorize(request, 'POST /api/v1/employeurs');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() =>
    {
      throw new AppError('Invalid JSON in request body', 400);
    });
    const input = companyCreateSchema.parse(body);

    const company = await createCompany(input, false);

    return Response.json(company, { status: 201 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}
