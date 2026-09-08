import { randomUUID } from "node:crypto"

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import type { PoolClient } from "pg"
import { z } from "zod"

import { hashPassword } from "@/lib/services/auth_service"
import { AppError } from "@/lib/services/error_service"
import { withTransaction } from "@/lib/services/postgres_client"
import { s3Client } from "@/lib/services/s3_client"

const MAX_KBIS_SIZE = 10 * 1024 * 1024
const KBIS_BUCKET = process.env.GARAGE_DEFAULT_BUCKET ?? "kbis-documents"

const passwordSchema = z.string()
  .min(8, { message: "Le mot de passe doit contenir au moins 8 caractères." })
  .max(32, { message: "Le mot de passe ne doit pas dépasser 32 caractères." })
  .regex(/[A-Z]/, { message: "Le mot de passe doit contenir au moins une lettre majuscule." })
  .regex(/[a-z]/, { message: "Le mot de passe doit contenir au moins une lettre minuscule." })
  .regex(/[0-9]/, { message: "Le mot de passe doit contenir au moins un chiffre." })
  .regex(/[^A-Za-z0-9]/, { message: "Le mot de passe doit contenir au moins un caractère spécial." })

const signupSchema = z.object({
  accountType: z.enum(["company", "partner"]),
  organizationName: z.string().trim().min(1).max(120),
  registrationNumber: z.string().regex(/^\d{14}$/, { message: "Le SIRET doit contenir exactement 14 chiffres." }),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: passwordSchema,
  phone: z.string().trim().min(1).max(30),
  legalRepresentative: z.string().trim().min(1).max(120),
  jobTitle: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(255),
  postalCode: z.string().trim().regex(/^\d{5}$/, { message: "Le code postal doit contenir exactement 5 chiffres." }),
  city: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
}).superRefine((value, ctx) => {
  if (`${value.address}, ${value.city}`.length > 255) {
    ctx.addIssue({
      code: "custom",
      path: ["address"],
      message: "L'adresse complète ne doit pas dépasser 255 caractères.",
    })
  }
})

export type ProfessionalSignupInput = z.input<typeof signupSchema>

type RegistrationResult = {
  user: {
    id: string
    email: string
    role: "COMPANY" | "PARTNER"
  }
  company: {
    id: string
    name: string
    siret: string
    verified: boolean
    isPartner: boolean
  }
}

function splitRepresentative(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 1) {
    return { surname: "", name: parts[0]! }
  }

  return {
    surname: parts[0]!,
    name: parts.slice(1).join(" "),
  }
}

// The category must already exist: an online registration never creates a new
// one, it can only reference a category the administration has set up.
async function findCategoryId(client: PoolClient, category: string): Promise<number> {
  const existing = await client.query<{ id: number }>(
    'SELECT id FROM public."companyCategory" WHERE category = $1 LIMIT 1',
    [category],
  )
  if (!existing.rows[0]) {
    throw new AppError("The selected category is invalid.", 400)
  }

  return existing.rows[0].id
}

async function assertAvailable(client: PoolClient, email: string, siret: string) {
  const existingUser = await client.query(
    'SELECT 1 FROM public.users WHERE LOWER(email) = LOWER($1) AND "expiredAt" IS NULL LIMIT 1',
    [email],
  )
  if (existingUser.rowCount) {
    throw new AppError("Un compte existe déjà avec cette adresse email.", 409)
  }

  const existingCompany = await client.query(
    'SELECT 1 FROM public.company WHERE LOWER(email) = LOWER($1) OR siret = $2 LIMIT 1',
    [email, siret],
  )
  if (existingCompany.rowCount) {
    throw new AppError("Une entreprise existe déjà avec cet email ou ce SIRET.", 409)
  }
}

function isPostgresUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
}

export function validateProfessionalSignup(input: ProfessionalSignupInput) {
  return signupSchema.parse(input)
}

export async function registerProfessionalAccount(
  input: ProfessionalSignupInput,
  kbis: File,
): Promise<RegistrationResult> {
  const data = validateProfessionalSignup(input)

  if (kbis.size <= 0) {
    throw new AppError("Le Kbis au format PDF est obligatoire.", 400)
  }
  if (kbis.size > MAX_KBIS_SIZE) {
    throw new AppError("Le Kbis ne doit pas dépasser 10 Mo.", 400)
  }
  if (kbis.type && kbis.type !== "application/pdf" && !kbis.name.toLowerCase().endsWith(".pdf")) {
    throw new AppError("Le Kbis doit être fourni au format PDF.", 400)
  }

  const kbisBytes = Buffer.from(await kbis.arrayBuffer())
  if (kbisBytes.length < 5 || kbisBytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new AppError("Le fichier Kbis fourni n'est pas un PDF valide.", 400)
  }

  const documentId = randomUUID()
  const companyId = randomUUID()
  const userId = randomUUID()
  const role = data.accountType === "partner" ? "PARTNER" : "COMPANY"
  const isPartner = role === "PARTNER"
  const storageKey = `professional-signups/${isPartner ? "partners" : "companies"}/${companyId}/kbis.pdf`
  const representative = splitRepresentative(data.legalRepresentative)
  const fullAddress = `${data.address}, ${data.city}`
  const passwordHash = hashPassword(data.password)

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: KBIS_BUCKET,
      Key: storageKey,
      Body: kbisBytes,
      ContentType: "application/pdf",
      Metadata: {
        source: "professional-signup",
        accounttype: data.accountType,
        siret: data.registrationNumber,
      },
    }))
  } catch (error) {
    console.error("Professional signup KBIS upload failed", error)
    throw new AppError("Le stockage du Kbis est temporairement indisponible.", 503)
  }

  try {
    await withTransaction(async (client) => {
      await assertAvailable(client, data.email, data.registrationNumber)

      const categoryId = await findCategoryId(client, data.category)

      await client.query(
        `INSERT INTO public.document (id, "storageKey", "mimeType", size, "createdAt")
         VALUES ($1, $2, 'application/pdf', $3, NOW())`,
        [documentId, storageKey, kbisBytes.length],
      )

      await client.query(
        // No agent and no validation reason at registration time: both are set
        // later by a real administrator when the file is reviewed.
        `INSERT INTO public.company (
           id, name, email, siret, "kbisId", description, address, "postalCode",
           verified, "categoryId",
           location, "isPartner", active, "createdAt", "updatedAt"
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8,
           FALSE, $9,
           ST_SetSRID(ST_MakePoint(0, 0), 4326), $10, TRUE, NOW(), NOW()
         )`,
        [
          companyId,
          data.organizationName,
          data.email,
          data.registrationNumber,
          documentId,
          data.description,
          fullAddress,
          data.postalCode,
          categoryId,
          isPartner,
        ],
      )

      await client.query(
        `INSERT INTO public.users (
           id, email, surname, name, role, balance, password,
           "createdAt", "updatedAt", "expiredAt", "companyId"
         ) VALUES ($1, $2, $3, $4, $5, 0, $6, NOW(), NOW(), NULL, $7)`,
        [
          userId,
          data.email,
          representative.surname,
          representative.name,
          role,
          passwordHash,
          companyId,
        ],
      )
    })
  } catch (error) {
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: KBIS_BUCKET, Key: storageKey }))
    } catch (cleanupError) {
      console.error("Professional signup KBIS cleanup failed", cleanupError)
    }

    if (error instanceof AppError) throw error
    if (isPostgresUniqueViolation(error)) {
      throw new AppError("Un compte existe déjà avec cet email ou ce SIRET.", 409)
    }

    console.error("Professional signup database transaction failed", error)
    throw new AppError("La création du compte a échoué.", 500)
  }

  return {
    user: {
      id: userId,
      email: data.email,
      role,
    },
    company: {
      id: companyId,
      name: data.organizationName,
      siret: data.registrationNumber,
      verified: false,
      isPartner,
    },
  }
}
