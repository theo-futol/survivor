import { z } from 'zod';
import { authorize } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { resolveActor } from '@/lib/services/ownership_service';
import { buildMeta, parsePagination } from '@/lib/services/pagination';
import { companyCreateSchema, createCompany, listCompanies } from '@/lib/services/company_service';

const categorieSchema = z.string().max(120).regex(/^[^<>'"&]*$/).optional();
const featuredSchema = z.enum(['true', 'false']).optional();

/**
 * @openapi
 * /api/v1/partenaires:
 *   get:
 *     summary: Liste paginée des partenaires
 *     description: Retourne les partenaires actifs (entreprises dont `isPartner` vaut `true`), profil complet et catégorie d'entreprise incluse. Un utilisateur `PARTNER` ne voit que sa propre fiche ; un `ADMIN` les voit toutes.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: categorie
 *         schema: { type: string }
 *         description: Nom de la catégorie d'entreprise à filtrer.
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: ['true', 'false'] }
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
 *                   items: { type: object }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *       '400': { description: Paramètres de requête invalides. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant. }
 *       '404': { description: Catégorie inconnue. }
 *       '500': { description: Erreur serveur interne. }
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
    const featured = featuredSchema.parse(url.searchParams.get('featured') ?? undefined);

    const { data, total } = await listCompanies({
      isPartner: true,
      pagination,
      categorie,
      featured: featured === undefined ? undefined : featured === 'true',
      id: actor.role === 'ADMIN' ? undefined : (actor.companyId ?? ''),
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
 *     summary: Création d'un partenaire
 *     description: Crée une entreprise partenaire (`isPartner = true`). Tous les champs non nullables de la table `Company` sont requis, y compris `kbisId` qui doit référencer un document KBIS déjà existant. Réservé aux administrateurs.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, siret, kbisId, address, postalCode, agentId, reasonId, categoryId, location]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               siret: { type: string, pattern: '^\d{14}$' }
 *               kbisId: { type: string, format: uuid }
 *               address: { type: string }
 *               postalCode: { type: string, pattern: '^\d{5}$' }
 *               agentId: { type: integer }
 *               reasonId: { type: integer }
 *               categoryId: { type: integer }
 *               location:
 *                 type: object
 *                 properties:
 *                   lat: { type: number }
 *                   lng: { type: number }
 *               verified: { type: boolean }
 *               isFeatured: { type: boolean }
 *     responses:
 *       '201':
 *         description: Partenaire créé.
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '400': { description: Corps de requête invalide. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant. }
 *       '409': { description: Un partenaire possède déjà cet email, ce SIRET ou ce KBIS. }
 *       '500': { description: Erreur serveur interne. }
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
