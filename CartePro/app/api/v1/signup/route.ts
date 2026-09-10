import { NextResponse } from "next/server"
import { z } from "zod"

import { AUTH_COOKIE_NAME, signToken } from "@/lib/services/auth_service"
import { AppError, commonErrorHandler } from "@/lib/services/error_service"
import { registerProfessionalAccount } from "@/lib/services/professional_signup_service"

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim()
}

/**
 * @openapi
 * /api/v1/signup:
 *   post:
 *     tags:
 *       - Authentification
 *     summary: Inscription publique entreprise ou partenaire
 *     description: "Enregistre le document KBIS dans Garage (S3), crée la fiche entreprise et son compte utilisateur propriétaire dans PostgreSQL (au statut non vérifié pour revue administrative), puis ouvre une session JWT."
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - accountType
 *               - organizationName
 *               - registrationNumber
 *               - email
 *               - password
 *               - phone
 *               - legalRepresentative
 *               - jobTitle
 *               - address
 *               - postalCode
 *               - city
 *               - category
 *               - kbis
 *             properties:
 *               accountType:
 *                 type: string
 *                 enum: [company, partner]
 *                 description: "Type d'organisation : 'company' pour employeur, 'partner' pour partenaire"
 *                 example: "company"
 *               organizationName:
 *                 type: string
 *                 description: "Raison sociale de l'organisation"
 *                 example: "Acme Corp SAS"
 *               registrationNumber:
 *                 type: string
 *                 pattern: '^\\d{14}$'
 *                 description: "Numéro SIRET à 14 chiffres"
 *                 example: "12345678901234"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contact@acmepartner.fr"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: "8 à 32 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial"
 *                 example: "Secret123!"
 *               phone:
 *                 type: string
 *                 example: "0601020304"
 *               legalRepresentative:
 *                 type: string
 *                 description: "Représentant légal de l'entreprise"
 *                 example: "Jean Dupont"
 *               jobTitle:
 *                 type: string
 *                 description: "Fonction du représentant"
 *                 example: "Directeur Général"
 *               address:
 *                 type: string
 *                 example: "12 rue de la République"
 *               postalCode:
 *                 type: string
 *                 pattern: '^\\d{5}$'
 *                 example: "13001"
 *               city:
 *                 type: string
 *                 example: "Marseille"
 *               category:
 *                 type: string
 *                 description: "Libellé de la catégorie d'activité"
 *                 example: "Services"
 *               description:
 *                 type: string
 *                 description: "Description facultative de l'activité"
 *                 example: "Prestations d'ingénierie et de conseil"
 *               kbis:
 *                 type: string
 *                 format: binary
 *                 description: "Fichier PDF du KBIS (maximum 5 Mo)"
 *     responses:
 *       '201':
 *         description: Compte créé avec succès et session ouverte.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/UserSummary'
 *                 company:
 *                   $ref: '#/components/schemas/CompanyDetail'
 *                 expiresIn:
 *                   type: integer
 *                   example: 1800
 *       '400':
 *         description: "Formulaire invalide ou fichier KBIS non conforme (doit être un PDF de moins de 5 Mo)."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: "L'adresse email ou le SIRET est déjà associé à un compte."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '503':
 *         description: "Service de stockage Garage S3 temporairement indisponible."
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
export async function POST(request: Request) {
  try {
    const form = await request.formData().catch(() => {
      throw new AppError("Invalid form data.", 400)
    })
    const kbis = form.get("kbis")

    if (!(kbis instanceof File) || kbis.type !== "application/pdf") {
      throw new AppError("The Kbis must be a pdf file.", 400)
    }
    if (kbis.size > 5 * 1024 * 1024) {
      throw new AppError("The Kbis file size must not exceed 5MB.", 400)
    }

    const result = await registerProfessionalAccount({
      accountType: text(form, "accountType") as "company" | "partner",
      organizationName: text(form, "organizationName"),
      registrationNumber: text(form, "registrationNumber").replace(/\s/g, ""),
      email: text(form, "email"),
      password: text(form, "password"),
      phone: text(form, "phone"),
      legalRepresentative: text(form, "legalRepresentative"),
      jobTitle: text(form, "jobTitle"),
      address: text(form, "address"),
      postalCode: text(form, "postalCode"),
      city: text(form, "city"),
      category: text(form, "category"),
      description: text(form, "description"),
    }, kbis);

    const { token, expiresIn } = await signToken({ sub: result.user.id, role: result.user.role })
    const response = NextResponse.json({ ...result, expiresIn }, { status: 201 })

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: expiresIn,
    })

    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Formulaire invalide." }, { status: 400 })
    }

    const { message, statusCode } = commonErrorHandler(error)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
