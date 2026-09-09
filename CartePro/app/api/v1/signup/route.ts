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
 *     summary: Inscription publique entreprise ou partenaire
 *     description: Crée le document Kbis dans Garage, l'entreprise et son utilisateur propriétaire dans PostgreSQL, puis ouvre une session JWT. Le compte est créé non vérifié afin de rester visible dans l'administration avant validation.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [accountType, organizationName, registrationNumber, email, password, phone, legalRepresentative, jobTitle, address, postalCode, city, category, kbis]
 *             properties:
 *               accountType: { type: string, enum: [company, partner] }
 *               organizationName: { type: string }
 *               registrationNumber: { type: string, pattern: '^\\d{14}$' }
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               phone: { type: string }
 *               legalRepresentative: { type: string }
 *               jobTitle: { type: string }
 *               address: { type: string }
 *               postalCode: { type: string, pattern: '^\\d{5}$' }
 *               city: { type: string }
 *               category: { type: string }
 *               description: { type: string }
 *               kbis: { type: string, format: binary }
 *     responses:
 *       '201': { description: Compte créé et session ouverte. }
 *       '400': { description: Formulaire ou Kbis invalide. }
 *       '409': { description: Email ou SIRET déjà utilisé. }
 *       '503': { description: Stockage Garage temporairement indisponible. }
 * 
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
