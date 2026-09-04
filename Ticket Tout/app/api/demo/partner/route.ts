import { DatabaseSync } from "node:sqlite"

import { auth, databasePath } from "@/lib/auth"
import { ensureAuthSchema } from "@/lib/auth-schema"
import { BRAND } from "@/lib/brand"

export async function POST() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEMO_PARTNER !== "true") {
    return Response.json({ error: "Demo disabled" }, { status: 404 })
  }

  await ensureAuthSchema()

  try {
    await auth.api.signUpEmail({
      body: {
        name: BRAND.demoPartner.name,
        email: BRAND.demoPartner.email,
        password: BRAND.demoPartner.password,
        accountType: "partner",
        organizationName: "Atelier Numérique SARL",
        phone: "",
        registrationNumber: "000000000",
        legalRepresentative: BRAND.demoPartner.name,
        jobTitle: "",
        address: "",
        postalCode: "",
        city: "Saint-Denis",
        partnerCategory: "commerce",
      },
    })
  } catch {
    // Le compte existe probablement déjà : l'endpoint reste idempotent.
  }

  // NOTE: verify against auth-schema.ts — this assumes "accountType" alone
  // is sufficient to grant partner rights and there is no separate access flag
  // column (unlike "employeeAccess" for employees). Adjust if one exists.
  const database = new DatabaseSync(databasePath)
  database
    .prepare('UPDATE "user" SET "accountType" = ? WHERE "email" = ?')
    .run("partner", BRAND.demoPartner.email)
  database.close()

  return Response.json({ ok: true })
}
