import { z } from 'zod';
import { authorize } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { resolveActor } from '@/lib/services/ownership_service';
import { buildMeta, parsePagination } from '@/lib/services/pagination';
import { companyCreateSchema, createCompany, listCompanies } from '@/lib/services/company_service';

const categorieSchema = z.string().max(120).regex(/^[^<>'"&]*$/).optional();
const includeInactiveSchema = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');

/**
 * @openapi
 * /api/v1/partenaires:
 *   get:
 *     tags:
 *       - Partenaires
 *     summary: Liste paginée des partenaires
 *     description: "Retourne les partenaires actifs (entreprises dont `isPartner` vaut `true`), profil complet et catégorie d'entreprise incluse. Un salarié ou un administrateur voit tout le réseau ; un utilisateur `PARTNER` ne voit que sa propre fiche, sauf s'il passe `network=true` pour parcourir le réseau des partenaires validés (comme le ferait un salarié). Les partenaires suspendus (`active = false`) sont exclus, sauf pour un `ADMIN` passant `includeInactive=true` — seul moyen de retrouver un compte suspendu pour le réactiver."
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
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
 *         description: "Nombre de partenaires par page (max 100)"
 *       - in: query
 *         name: categorie
 *         schema:
 *           type: string
 *         description: "Filtrer par libellé exact de la catégorie professionnelle"
 *       - in: query
 *         name: network
 *         schema:
 *           type: boolean
 *           default: false
 *         description: "Réservé aux appelants `PARTNER` : passer `true` pour consulter le réseau des autres partenaires validés plutôt que sa propre fiche."
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: "Réservé à `ADMIN` : inclut aussi les partenaires suspendus."
 *     responses:
 *       '200':
 *         description: Liste paginée des partenaires récupérée avec succès.
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
 *         description: Paramètres de pagination ou de filtrage invalides.
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
 *       '404':
 *         description: Catégorie professionnelle inconnue.
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
    const auth = await authorize(request, 'GET /api/v1/partenaires');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const actor = await resolveActor(auth);
    const url = new URL(request.url);
    const pagination = parsePagination(url);
    const categorie = categorieSchema.parse(url.searchParams.get('categorie') ?? undefined);
    // Opt-in only: a PARTNER caller stays restricted to its own profile unless
    // it explicitly asks to browse the network, so every existing caller of
    // this route keeps its current behavior.
    const browsingNetwork = actor.role === 'PARTNER' && url.searchParams.get('network') === 'true';
    const includeInactive = includeInactiveSchema.parse(url.searchParams.get('includeInactive') ?? undefined);

    const { data, total } = await listCompanies({
      isPartner: true,
      pagination,
      categorie,
      verified: actor.role === 'EMPLOYEE' || browsingNetwork ? true : undefined,
      id: actor.role === 'PARTNER' && !browsingNetwork ? (actor.companyId ?? '') : undefined,
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
 * /api/v1/partenaires:
 *   post:
 *     tags:
 *       - Partenaires
 *     summary: Création administrative d'un partenaire marchand
 *     description: "Crée une entreprise partenaire (`isPartner = true`). Tous les champs non nullables de la table `Company` sont requis, y compris `kbisId` qui doit référencer un document KBIS déjà existant. Réservé aux administrateurs. Le champ `verified` n'est pas acceptable à la création : toute inscription crée un partenaire non vérifié, validé ensuite via `PATCH`."
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
 *                 example: "Le Bistrot Gourmand SARL"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contact@bistrotgourmand.fr"
 *               siret:
 *                 type: string
 *                 pattern: '^\\d{14}$'
 *                 description: "Numéro SIRET à 14 chiffres"
 *                 example: "98765432109876"
 *               kbisId:
 *                 type: string
 *                 format: uuid
 *                 description: "Identifiant UUID du document KBIS préalablement téléversé"
 *                 example: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 *               address:
 *                 type: string
 *                 example: "8 place du Marché"
 *               postalCode:
 *                 type: string
 *                 pattern: '^\\d{5}$'
 *                 example: "13001"
 *               agentId:
 *                 type: string
 *                 format: uuid
 *                 description: "Identifiant UUID de l'agent créateur"
 *                 example: "11111111-2222-3333-4444-555555555555"
 *               reasonId:
 *                 type: integer
 *                 description: "Identifiant du motif d'adhésion"
 *                 example: 1
 *               categoryId:
 *                 type: integer
 *                 description: "Identifiant de la catégorie professionnelle"
 *                 example: 1
 *               description:
 *                 type: string
 *                 example: "Restaurant traditionnel et salon de thé"
 *               location:
 *                 type: object
 *                 required:
 *                   - lat
 *                   - lng
 *                 properties:
 *                   lat:
 *                     type: number
 *                     example: 43.297
 *                   lng:
 *                     type: number
 *                     example: 5.372
 *     responses:
 *       '201':
 *         description: Partenaire créé avec succès.
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
 *         description: "Un partenaire possède déjà cette adresse email, ce SIRET ou ce document KBIS."
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
    const auth = await authorize(request, 'POST /api/v1/partenaires');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() =>
    {
      throw new AppError('Invalid JSON in request body', 400);
    });
    const input = companyCreateSchema.parse(body);

    const partner = await createCompany(input, true);

    return Response.json(partner, { status: 201 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}
