import { z } from "zod"

import { AppError, commonErrorHandler } from "@/lib/services/error_service"
import { withTransaction } from "@/lib/services/postgres_client"

const paramsSchema = z.object({ highlightId: z.coerce.number().int().positive() })

/**
 * @openapi
 * /api/v1/featuredpartner/{highlightId}/click:
 *   post:
 *     summary: Compter un clic sur un partenaire mis en avant
 *     description: Incrémente le compteur de clics de l'encart. Route publique.
 *     parameters:
 *       - in: path
 *         name: highlightId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200': { description: Clic comptabilisé. }
 *       '404': { description: Encart introuvable. }
 */
export async function POST(_request: Request, { params }: { params: Promise<{ highlightId: string }> }) {
  try {
    const { highlightId } = paramsSchema.parse(await params)
    const clicks = await withTransaction(async (client) => {
      const result = await client.query(
        'UPDATE "featuredPartner" SET "clickAmount" = "clickAmount" + 1, "updatedAt" = now() WHERE id = $1 RETURNING "clickAmount"',
        [highlightId],
      )
      if (result.rowCount === 0) throw new AppError("Featured partner entry not found", 404)
      return Number(result.rows[0].clickAmount)
    })

    return Response.json({ clicks }, { status: 200 })
  } catch (error) {
    const { message, statusCode } = commonErrorHandler(error)
    return Response.json({ error: message }, { status: statusCode })
  }
}
