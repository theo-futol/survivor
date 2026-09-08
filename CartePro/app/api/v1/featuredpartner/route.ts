import { z } from "zod"

import { db } from "@/lib/prisma/db"
import { authorize } from "@/lib/services/auth_service"
import { AppError, commonErrorHandler } from "@/lib/services/error_service"
import { saveFeaturedPartnerImage } from "@/lib/services/featured_partner_storage"
import { withTransaction } from "@/lib/services/postgres_client"

const partnerIdSchema = z.uuid()
const messageSchema = z.string().trim().min(1).max(280)
const imageSchema = z
  .instanceof(File)
  .refine((file) => file.size <= 5 * 1024 * 1024, "Image too large")
  .refine((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type), "Unsupported image type")

function toPublicHighlight(row: any) {
  return {
    id: row.id,
    partnerId: row.companyId,
    name: row.company.name,
    address: row.company.address,
    postalCode: row.company.postalCode,
    message: row.message,
    imageUrl: `/api/v1/featuredpartner/${row.id}/image`,
    clickAmount: row.clickAmount,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * @openapi
 * /api/v1/featuredpartner:
 *   get:
 *     summary: Partenaire actuellement mis en avant
 *     description: Sans paramètre, retourne l'encart public actuellement publié. Avec `history=true`, retourne l'historique complet et nécessite un compte ADMIN.
 *     parameters:
 *       - in: query
 *         name: history
 *         schema: { type: boolean }
 *     responses:
 *       '200': { description: Encart actuel ou historique récupéré. }
 *       '401': { description: Authentification requise pour l'historique. }
 *       '403': { description: Historique réservé aux administrateurs. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const history = url.searchParams.get("history") === "true"

    if (history) {
      const auth = await authorize(request, "GET /api/v1/featuredpartner")
      if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
    }

    const rows = await db.orm.public.FeaturedPartner
      .include("company", (company) => company.select("id", "name", "address", "postalCode", "active", "isPartner"))
      .orderBy((highlight) => highlight.updatedAt.desc())
      .all()

    const eligible = rows.filter((row) => row.company.active && row.company.isPartner)

    if (!history) {
      const current = eligible.find((row) => row.active)
      return Response.json({ featuredPartner: current ? toPublicHighlight(current) : null }, { status: 200 })
    }

    return Response.json({ featuredPartners: eligible.map(toPublicHighlight) }, { status: 200 })
  } catch (error) {
    const { message, statusCode } = commonErrorHandler(error)
    return Response.json({ error: message }, { status: statusCode })
  }
}

/**
 * @openapi
 * /api/v1/featuredpartner:
 *   post:
 *     summary: Publier un partenaire mis en avant
 *     description: Publie immédiatement un nouvel encart public avec photo et message. L'ancien encart reste dans l'historique. Réservé aux administrateurs.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [partnerId, message, image]
 *             properties:
 *               partnerId: { type: string, format: uuid }
 *               message: { type: string, maxLength: 280 }
 *               image: { type: string, format: binary }
 *     responses:
 *       '201': { description: Encart publié. }
 *       '400': { description: Formulaire invalide. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant. }
 *       '404': { description: Partenaire introuvable. }
 *       '503': { description: Stockage de l'image indisponible. }
 */
export async function POST(request: Request) {
  try {
    const auth = await authorize(request, "POST /api/v1/featuredpartner")
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

    const form = await request.formData().catch(() => {
      throw new AppError("Invalid multipart form", 400)
    })

    const partnerId = partnerIdSchema.parse(form.get("partnerId"))
    const message = messageSchema.parse(form.get("message"))
    const image = imageSchema.parse(form.get("image"))

    const partner = await db.orm.public.Company.where({ id: partnerId, isPartner: true, active: true }).first()
    if (!partner) throw new AppError("Partner not found", 404)

    const imageKey = await saveFeaturedPartnerImage(image)

    const highlightId = await withTransaction(async (client) => {
      await client.query('UPDATE "featuredPartner" SET "active" = FALSE, "updatedAt" = now() WHERE "active" = TRUE')
      await client.query('UPDATE "company" SET "isFeatured" = FALSE WHERE "isPartner" = TRUE')

      const companyResult = await client.query(
        'UPDATE "company" SET "isFeatured" = TRUE, "updatedAt" = now() WHERE id = $1 AND "isPartner" = TRUE AND active = TRUE',
        [partnerId],
      )
      if (companyResult.rowCount === 0) throw new AppError("Partner not found", 404)

      const result = await client.query(
        `INSERT INTO "featuredPartner" ("companyId", "message", "imageKey", "clickAmount", "active", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 0, TRUE, now(), now())
         RETURNING id`,
        [partnerId, message, imageKey],
      )

      return Number(result.rows[0].id)
    })

    return Response.json({ status: "published", id: highlightId, partnerId }, { status: 201 })
  } catch (error) {
    const { message, statusCode } = commonErrorHandler(error)
    return Response.json({ error: message }, { status: statusCode })
  }
}
