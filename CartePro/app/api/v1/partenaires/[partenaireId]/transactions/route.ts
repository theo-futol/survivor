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
 *     summary: Retrieve transactions for a specific partner
 *     description: "Return the paginated list of transactions billed to the given partner, newest first, each with the salarié who paid. A `PARTNER` may only read its own company; an `ADMIN` may read any. A partner with no sales yet gets an empty list, not a 404."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partenaireId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Partner ID.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       '200':
 *         description: Paginated list of transactions for the specified partner.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       amount: { type: number }
 *                       status: { type: string }
 *                       type: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                       updatedAt: { type: string, format: date-time }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     totalCount: { type: integer }
 *                     totalPages: { type: integer }
 *                     hasNextPage: { type: boolean }
 *                     hasPrevPage: { type: boolean }
 *       '400':
 *         description: Invalid parameters.
 *       '401':
 *         description: Missing or invalid token.
 *       '403':
 *         description: Insufficient role, or an attempt to read another partner's transactions.
 *       '500':
 *         description: Server error.
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
