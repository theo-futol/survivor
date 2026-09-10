import { db } from "@/lib/prisma/db";
import { z } from "zod";
import {
  parsePaginationParams,
  computeOffset,
  buildPaginationMeta,
} from "@/lib/pagination";
import { authorize } from "@/lib/services/auth_service";
import { resolveActor, assertOwnsCompany } from "@/lib/services/ownership_service";
import { commonErrorHandler } from "@/lib/services/error_service";

const partnerParamsSchema = z.object({
  partenaireId: z.uuid(),
});

/**
 * @openapi
 * /api/v1/partenaires/{partenaireId}/transactions:
 *   get:
 *     tags:
 *       - Transactions
 *     summary: Historique des encaissements d'un partenaire
 *     description: "Retourne la liste paginée des transactions encaissées par le partenaire marchand, de la plus récente à la plus ancienne, incluant l'identité du salarié bénéficiaire ayant payé. Un `PARTNER` ne consulte que ses propres transactions de caisse ; un `ADMIN` peut consulter celles de n'importe quel partenaire. Un partenaire sans transaction retourne une liste vide avec un code 200."
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
 *         description: "Identifiant du partenaire marchand"
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
 *         description: "Nombre de transactions par page"
 *     responses:
 *       '200':
 *         description: Historique des encaissements récupéré avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - transactions
 *                 - meta
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: "c71a3932-d17e-4629-9dc4-1b4d3752eef5"
 *                       amount:
 *                         type: integer
 *                         description: "Montant en centimes d'euro"
 *                         example: 1850
 *                       status:
 *                         type: string
 *                         enum: [VALIDER, REFUSER]
 *                         example: "VALIDER"
 *                       type:
 *                         type: string
 *                         enum: [PAYMENT, REFUND, TOPUP]
 *                         example: "PAYMENT"
 *                       companyId:
 *                         type: string
 *                         format: uuid
 *                         example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                             example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
 *                           name:
 *                             type: string
 *                             example: "Jean"
 *                           surname:
 *                             type: string
 *                             example: "Dupont"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-09-02T12:30:00.000Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-09-02T12:30:00.000Z"
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMetaB'
 *       '400':
 *         description: Identifiant ou paramètres de pagination invalides.
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
 *         description: "Rôle insuffisant ou tentative de consulter les encaissements d'un autre point de vente."
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
export async function GET(request: Request, { params }: { params: Promise<{ partenaireId: string }> })
{
    try {
        const auth = await authorize(request, 'GET /api/v1/partenaires/:partenaireId/transactions');

        if (!auth.ok) {
            return Response.json({ error: auth.error }, { status: auth.status });
        }

        const { partenaireId } = await params;

        const partnerParseResult = await partnerParamsSchema.safeParseAsync({ partenaireId });
        if (!partnerParseResult.success) {
            console.error("Invalid parameters", JSON.stringify(partnerParseResult.error));
            return Response.json({ error: "Invalid parameters" }, { status: 400 });
        }

        // A partner reads its own till, an admin reads anyone's.
        assertOwnsCompany(await resolveActor(auth), partenaireId);

        const { searchParams } = new URL(request.url);

        const queryParseResult = await parsePaginationParams(searchParams);
        if (!queryParseResult.success) {
            console.error("Invalid query parameters", JSON.stringify(queryParseResult.error));
            return Response.json({ error: "Invalid query parameters" }, { status: 400 });
        }

        const { limit, page } = queryParseResult.data;
        const offset = computeOffset(page, limit);

        const [transactions, totalCount] = await Promise.all([
        db.orm.public.Transaction
            .where({ companyId: partenaireId })
            .include("user", (user) => user.select("id", "name", "surname"))
            .orderBy((u) => u.createdAt.desc())
            .limit(limit)
            .offset(offset)
            .all(),
        db.orm.public.Transaction
            .where({ companyId: partenaireId })
            .aggregate((a) => ({ total: a.count() }))
        ]);

        return Response.json(
        {
            transactions,
            meta: buildPaginationMeta(totalCount.total, page, limit),
        },
        { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching partner transactions", error);
        const { message, statusCode } = commonErrorHandler(error);
        return Response.json({ error: message }, { status: statusCode });
    }
}
