import { z } from "zod"

import { db } from "@/lib/prisma/db"
import { commonErrorHandler } from "@/lib/services/error_service"
import { readFeaturedPartnerImage } from "@/lib/services/featured_partner_storage"

const paramsSchema = z.object({ highlightId: z.coerce.number().int().positive() })

/**
 * @openapi
 * /api/v1/featuredpartner/{highlightId}/image:
 *   get:
 *     summary: Photo publique d'un partenaire mis en avant
 *     parameters:
 *       - in: path
 *         name: highlightId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200': { description: Image. }
 *       '404': { description: Encart ou image introuvable. }
 */
export async function GET(_request: Request, { params }: { params: Promise<{ highlightId: string }> }) {
  try {
    const { highlightId } = paramsSchema.parse(await params)
    const row = await db.orm.public.FeaturedPartner.where({ id: highlightId }).first()
    if (!row) return new Response(null, { status: 404 })

    const image = await readFeaturedPartnerImage(row.imageKey)
    if (!image) return new Response(null, { status: 404 })

    return new Response(Buffer.from(image.bytes), {
      status: 200,
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": image.cacheControl,
      },
    })
  } catch (error) {
    const { message, statusCode } = commonErrorHandler(error)
    return Response.json({ error: message }, { status: statusCode })
  }
}
