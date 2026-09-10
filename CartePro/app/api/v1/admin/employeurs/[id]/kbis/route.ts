import { GetObjectCommand } from "@aws-sdk/client-s3"
import { z } from "zod"

import { db } from "@/lib/prisma/db"
import { authorize } from "@/lib/services/auth_service"
import { commonErrorHandler } from "@/lib/services/error_service"
import { s3Client } from "@/lib/services/s3_client"

const paramsSchema = z.object({ id: z.uuid() })
const KBIS_BUCKET = process.env.GARAGE_DEFAULT_BUCKET ?? "kbis-documents"

/**
 * @openapi
 * /api/v1/admin/employeurs/{id}/kbis:
 *   get:
 *     tags:
 *       - Administration
 *     summary: Téléchargement de l'extrait KBIS d'un employeur
 *     description: "Récupère le document KBIS associé à l'entreprise employeur dans PostgreSQL, puis extrait et renvoie le flux PDF correspondant depuis le stockage objet Garage S3 (`kbis-<siret>.pdf`). Réservé aux administrateurs."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identifiant unique de l'employeur"
 *     responses:
 *       '200':
 *         description: Extrait KBIS au format PDF.
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       '400':
 *         description: Identifiant UUID invalide.
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
 *       '404':
 *         description: Employeur ou document KBIS introuvable dans la base ou sur Garage S3.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '503':
 *         description: Service de stockage Garage S3 temporairement inaccessible.
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
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorize(request, "GET /api/v1/admin/employeurs/:id/kbis")

    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = paramsSchema.parse(await params)

    const company = await db.orm.public.Company
      .where({ id, isPartner: false, active: true })
      .include("kbis", (kbis) => kbis.select("id", "storageKey", "mimeType", "size"))
      .first()

    if (!company) {
      return Response.json({ error: "Employer not found" }, { status: 404 })
    }

    if (!company.kbis?.storageKey) {
      return Response.json({ error: "KBIS document not found" }, { status: 404 })
    }

    try {
      const object = await s3Client.send(
        new GetObjectCommand({
          Bucket: KBIS_BUCKET,
          Key: company.kbis.storageKey,
        }),
      )

      if (!object.Body) {
        return Response.json({ error: "KBIS file not found" }, { status: 404 })
      }

      const bytes = await object.Body.transformToByteArray()
      const contentType = object.ContentType ?? company.kbis.mimeType ?? "application/pdf"

      return new Response(Buffer.from(bytes), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="kbis-${company.siret}.pdf"`,
          "Content-Length": String(object.ContentLength ?? company.kbis.size ?? bytes.byteLength),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      })
    } catch (storageError) {
      const name = storageError instanceof Error ? storageError.name : ""

      if (name === "NoSuchKey" || name === "NotFound") {
        return Response.json({ error: "KBIS file not found" }, { status: 404 })
      }

      console.error("KBIS Garage read failed", storageError)
      return Response.json({ error: "KBIS storage temporarily unavailable" }, { status: 503 })
    }
  } catch (error) {
    const { message, statusCode } = commonErrorHandler(error)
    return Response.json({ error: message }, { status: statusCode })
  }
}
