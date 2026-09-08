import { z } from "zod"

import { db } from "@/lib/prisma/db"
import { authorize } from "@/lib/services/auth_service"
import { AppError, commonErrorHandler } from "@/lib/services/error_service"
import { withTransaction } from "@/lib/services/postgres_client"

const paramsSchema = z.object({ highlightId: z.coerce.number().int().positive() })

/**
 * @openapi
 * /api/v1/featuredpartner/{highlightId}:
 *   patch:
 *     summary: Republier un ancien encart
 *     description: Remet immédiatement en ligne un ancien partenaire mis en avant avec son texte et sa photo d'origine. Réservé aux administrateurs.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: highlightId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200': { description: Ancien encart republié. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant. }
 *       '404': { description: Encart ou partenaire introuvable. }
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ highlightId: string }> }) {
  try {
    const auth = await authorize(request, "PATCH /api/v1/featuredpartner/:highlightId")
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

    const { highlightId } = paramsSchema.parse(await params)
    const existing = await db.orm.public.FeaturedPartner.where({ id: highlightId }).first()
    if (!existing) throw new AppError("Featured partner entry not found", 404)

    await withTransaction(async (client) => {
      await client.query('UPDATE "featuredPartner" SET "active" = FALSE, "updatedAt" = now() WHERE "active" = TRUE')
      await client.query('UPDATE "company" SET "isFeatured" = FALSE WHERE "isPartner" = TRUE')

      const companyResult = await client.query(
        'UPDATE "company" SET "isFeatured" = TRUE, "updatedAt" = now() WHERE id = $1 AND "isPartner" = TRUE AND active = TRUE',
        [existing.companyId],
      )
      if (companyResult.rowCount === 0) throw new AppError("Partner not found", 404)

      await client.query('UPDATE "featuredPartner" SET "active" = TRUE, "updatedAt" = now() WHERE id = $1', [highlightId])
    })

    return Response.json({ status: "published", id: highlightId, partnerId: existing.companyId }, { status: 200 })
  } catch (error) {
    const { message, statusCode } = commonErrorHandler(error)
    return Response.json({ error: message }, { status: statusCode })
  }
}
