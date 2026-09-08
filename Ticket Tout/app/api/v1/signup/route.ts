import { NextResponse } from "next/server"
import { z } from "zod"

import { AUTH_COOKIE_NAME, signToken } from "@/lib/services/auth_service"
import { AppError, commonErrorHandler } from "@/lib/services/error_service"
import { registerProfessionalAccount } from "@/lib/services/professional_signup_service"
import { uploadFile, deleteFile } from '@/lib/services/garage_service'
import { db } from "@/lib/prisma/db" 

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
 *             required: [accountType, organizationName, registrationNumber, email, password, phone, legalRepresentative, jobTitle, address, postalCode, city, kbis]
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
 *               partnerCategory: { type: string }
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
      partnerCategory: text(form, "partnerCategory"),
    }, kbis);

    const { token, expiresIn } = await signToken({ sub: result.user.id, role: result.user.role })
    const response = NextResponse.json({ ...result, expiresIn }, { status: 201 })

    const company = await db.orm.public.Company.where({ id: result.company.id }).first();

    if (company?.kbisId) {
      const oldDocs = await db.orm.public.Document.where({ id: company.kbisId }).first();

      await deleteFile(oldDocs?.storageKey ?? "").catch((err) => {
        console.error("Failed to delete old Kbis from Garage:", err);
        throw new AppError("Failed to delete old Kbis from Garage.", 500);
      });

      await db.transaction(async (tx) => {
        const res = await tx.orm.public.Document.where({ id: company.kbisId }).delete();

        if (!res) {
          throw new AppError("Failed to delete old Kbis from database.", 500);
        }
      });
    }

    const uploadResult = await uploadFile(await kbis.arrayBuffer().then(buf => Buffer.from(buf)), { contentType: kbis.type, extension: "pdf" }).catch((err) => {
      console.error("Failed to upload Kbis to Garage:", err);
      throw new AppError("Failed to upload Kbis to Garage.", 503);
    });

    await db.transaction(async (tx) => {
      const documentCreated = await tx.orm.public.Document.create({
        storageKey: uploadResult.key,
        mimeType: kbis.type,
        size: kbis.size,
      });

      if (!documentCreated) {
        throw new AppError("Failed to create Kbis document in database.", 500);
      }

      const updateResult = await tx.orm.public.Company.where({ id: result.company.id }).update({ kbisId: documentCreated.id });

      if (!updateResult) {
        throw new AppError("Failed to update company with Kbis document.", 500);
      }
    });

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
